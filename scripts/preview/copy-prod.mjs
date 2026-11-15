// Replaces everything in the preview database with a copy of production, to
// try a feature on the real data. Production is only read, in a read-only
// transaction; the preview keeps its own schema (its migrations are not
// touched) and gets its accounts back (Lomone, Aela), then a marker table that
// stops the preview seed from adding samples on top of the copy.
//
//   node scripts/preview/copy-prod.mjs [--source=<url prod>] [--cible=<url preview>] [--oui] [--essai]
//
// Both addresses are asked unless given; --oui confirms without asking;
// --essai shows what would be copied and stops. Refused unless the target
// already holds the preview's Lomone and the source does not (so the two can't
// be swapped), unless the preview has every migration of production, and,
// for a Supabase address, unless both databases are in Europe.
import postgres from "postgres";
import { connectionOptions } from "../../lib/db/url.mjs";
import { createPrompter } from "../legacy/prompt.mjs";
import { COPY_MARKER, ensurePreviewAccounts, GERANT } from "./accounts.mjs";

const PHRASE = "écraser la preview";
const CHUNK = 500;

const args = process.argv.slice(2);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dryRun = args.includes("--essai");
const confirmed = args.includes("--oui");

const prompter = createPrompter();
let source;
let target;
try {
  const sourceUrl = option("source") ?? (await prompter.ask("URL Postgres de la PROD (lue seulement) : ", { hidden: true }));
  const targetUrl = option("cible") ?? (await prompter.ask("URL Postgres de la PREVIEW (sera écrasée) : ", { hidden: true }));
  const from = connectionOptions(sourceUrl);
  const to = connectionOptions(targetUrl);
  const [a, b] = [new URL(from.url), new URL(to.url)];
  if (a.hostname === b.hostname && a.port === b.port && a.pathname === b.pathname && a.username === b.username) {
    throw new Error("La prod et la preview sont la même base.");
  }
  console.log(`Prod : ${describe(a)}\nPreview : ${describe(b)}`);

  source = postgres(from.url, { ssl: from.ssl, max: 1, prepare: false, onnotice: () => {} });
  target = postgres(to.url, { ssl: to.ssl, max: 1, prepare: false, onnotice: () => {} });

  if (!(await holdsLomone(target))) {
    throw new Error("La cible n'a pas le gérant Lomone des previews : ce n'est pas la base des previews.");
  }
  if (await holdsLomone(source)) {
    throw new Error("La source a le gérant Lomone des previews : ce n'est pas la prod (adresses inversées ?).");
  }

  const missing = await missingMigrations(source, target);
  if (missing > 0) {
    throw new Error(
      `La preview n'a pas ${missing} migration(s) de la prod : construis d'abord une preview à jour de main (workflow « Preview »).`,
    );
  }

  const targetTables = await tablesOf(target);
  // One consistent, read-only snapshot of production.
  const data = await source.begin("isolation level repeatable read read only", async (tx) => {
    const tables = await tablesOf(tx);
    const out = [];
    for (const [table, columns] of tables) {
      if (table === COPY_MARKER) continue;
      const kept = targetTables.get(table);
      if (!kept) throw new Error(`La table ${table} de la prod n'existe pas dans la preview.`);
      const lost = columns.filter((c) => !kept.includes(c));
      if (lost.length) throw new Error(`La preview n'a pas les colonnes ${lost.join(", ")} de ${table}.`);
      const rows = await tx.unsafe(`select coalesce(jsonb_agg(to_jsonb(t)), '[]') as rows from public."${table}" t`);
      out.push({ table, columns, rows: rows[0].rows });
    }
    return out;
  });

  console.log("\nÀ copier :");
  for (const { table, rows } of data) console.log(`  ${table} : ${rows.length}`);
  const emptied = [...targetTables.keys()].filter((t) => !data.some((d) => d.table === t) && t !== COPY_MARKER);
  if (emptied.length) console.log(`Vidées dans la preview (absentes de la prod) : ${emptied.join(", ")}`);

  if (dryRun) {
    console.log("\nEssai : rien n'a été écrit.");
  } else {
    const answer = confirmed ? PHRASE : await prompter.ask(`\nPour confirmer, tape « ${PHRASE} » : `);
    if (answer !== PHRASE) {
      console.log("Pas confirmé : rien n'a été écrit.");
    } else {
      await target.begin(async (tx) => write(tx, data, targetTables));
      console.log("\nCopie terminée : la preview a les données de la prod.");
    }
  }
} catch (error) {
  console.error(`\nÉchec : ${error.message}`);
  process.exitCode = 1;
} finally {
  prompter.close();
  await source?.end();
  await target?.end();
}

async function write(tx, data, targetTables) {
  const names = [...targetTables.keys()].map((t) => `public."${t}"`).join(", ");
  await tx.unsafe(`truncate ${names} restart identity cascade`);
  await tx.unsafe(`drop table if exists public."${COPY_MARKER}"`);

  const byName = new Map(data.map((d) => [d.table, d]));
  for (const table of await insertionOrder(tx)) {
    const copied = byName.get(table);
    if (!copied) continue;
    const cols = copied.columns.map((c) => `"${c}"`).join(", ");
    for (let i = 0; i < copied.rows.length; i += CHUNK) {
      const chunk = copied.rows.slice(i, i + CHUNK);
      // Postgres turns the JSON back into each column's own type.
      await tx.unsafe(
        `insert into public."${table}" (${cols})
         select ${cols} from jsonb_populate_recordset(null::public."${table}", $1::text::jsonb)`,
        [JSON.stringify(chunk)],
      );
    }
  }

  // Sequences follow the copied ids, so new rows don't collide.
  const sequences = await tx`
    select c.relname as table, a.attname as column, pg_get_serial_sequence(format('public.%I', c.relname), a.attname) as seq
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r'
      and pg_get_serial_sequence(format('public.%I', c.relname), a.attname) is not null`;
  for (const { table, column, seq } of sequences) {
    await tx.unsafe(`select setval($1, coalesce((select max("${column}") from public."${table}"), 0) + 1, false)`, [seq]);
  }

  await ensurePreviewAccounts(tx);
  await tx.unsafe(`create table public."${COPY_MARKER}" (copied_at timestamptz not null default now())`);
  await tx.unsafe(`insert into public."${COPY_MARKER}" default values`);
}

/** Tables of the public schema, each with its columns, by name. */
async function tablesOf(sql) {
  const rows = await sql`
    select c.table_name as table, array_agg(c.column_name::text order by c.ordinal_position) as columns
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.is_generated = 'NEVER'
    group by c.table_name order by c.table_name`;
  return new Map(rows.map((r) => [r.table, r.columns]));
}

/** Public tables, each after the ones its foreign keys point to. */
async function insertionOrder(sql) {
  const tables = [...(await tablesOf(sql)).keys()];
  const edges = await sql`
    select src.relname as "from", dst.relname as "to"
    from pg_constraint k
    join pg_class src on src.oid = k.conrelid join pg_namespace n on n.oid = src.relnamespace
    join pg_class dst on dst.oid = k.confrelid
    where k.contype = 'f' and n.nspname = 'public' and src.oid <> dst.oid`;
  const order = [];
  const placed = new Set();
  const visit = (table, path = new Set()) => {
    if (placed.has(table)) return;
    if (path.has(table)) throw new Error(`Clés étrangères en boucle autour de ${table}.`);
    path.add(table);
    for (const e of edges) if (e.from === table) visit(e.to, path);
    path.delete(table);
    placed.add(table);
    order.push(table);
  };
  for (const t of tables) visit(t);
  return order;
}

async function holdsLomone(sql) {
  const [row] = await sql`
    select 1 from members where username = ${GERANT.username} and password_hash = ${GERANT.passwordHash}`;
  return Boolean(row);
}

/** How many migrations applied to the source the target lacks. Drizzle tells
 * them apart by date (created_at), not by content: a renumbered migration was
 * applied twice on the preview, under two dates. */
async function missingMigrations(source, target) {
  const dates = async (sql) =>
    (await sql`select created_at::text as at from drizzle.__drizzle_migrations`).map((r) => r.at);
  const have = new Set(await dates(target));
  return (await dates(source)).filter((d) => !have.has(d)).length;
}

/** Where a database is, refused outside Europe when Supabase's pooler names its region. */
function describe(url) {
  const region = url.hostname.match(/^aws-\d+-([a-z]+-[a-z]+-\d+)\.pooler\.supabase\.com$/)?.[1];
  if (region && !region.startsWith("eu-")) {
    throw new Error(`${url.hostname} est hors d'Europe (${region}) : les données du comptoir restent en Europe.`);
  }
  return `${url.hostname}${url.pathname}${region ? ` (région ${region})` : ""}`;
}
