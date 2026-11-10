// Loads an export of the old app (scripts/legacy/export.mjs) into a database
// of the new one, replacing its merchandise, stock history and register.
// Members are never changed: the old app's authors are matched to them by
// name, and those with no account get one, without a password.
//
//   node scripts/legacy/import.mjs <export.json> --cible=preview|prod
//     [--base=<url postgres>] [--oui] [--essai]
//
// The database address is asked unless given with --base. --oui confirms
// without asking; otherwise the target's phrase must be typed. --essai shows what would be
// written and stops. Before writing, the current data is saved to
// legacy-export/, and everything is written in one transaction.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { connectionOptions } from "../../lib/db/url.mjs";
import { mapLegacy, till } from "./map.mjs";
import { createPrompter } from "./prompt.mjs";

const TARGETS = { preview: "écraser la preview", prod: "écraser la prod", local: "écraser" };

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const target = args.find((a) => a.startsWith("--cible="))?.slice("--cible=".length);
const dryRun = args.includes("--essai");
const givenUrl = args.find((a) => a.startsWith("--base="))?.slice("--base=".length);
const confirmed = args.includes("--oui");

if (!file || !TARGETS[target]) {
  console.error(
    "Usage : node scripts/legacy/import.mjs <export.json> --cible=preview|prod [--base=<url>] [--oui] [--essai]",
  );
  process.exit(2);
}

const prompter = createPrompter();
let sql;
try {
  const data = JSON.parse(await readFile(file, "utf8"));
  const rawUrl = givenUrl ?? (await prompter.ask(`URL Postgres de la base ${target} : `, { hidden: true }));
  const { url, ssl } = connectionOptions(rawUrl);
  const where = new URL(url);
  if (target === "local" && !["localhost", "127.0.0.1", "[::1]"].includes(where.hostname)) {
    throw new Error("La cible local n'accepte qu'une base sur cette machine.");
  }
  sql = postgres(url, { ssl, max: 1, prepare: false, onnotice: () => {} });

  const members = await sql`select id, username, name, role from members`;
  const plan = mapLegacy(data, members);
  const [current] = await sql`
    select (select count(*) from products)::int as products,
           (select count(*) from stock_movements)::int as movements,
           (select count(*) from transactions)::int as transactions,
           (select count(*) from announcements)::int as announcements`;

  console.log(`\nCible : ${target.toUpperCase()}, ${where.username}@${where.host}${where.pathname}`);
  console.log(`Membres gardés : ${members.length}`);
  if (plan.newMembers.length) {
    console.log(
      `Comptes créés, sans mot de passe (le gérant leur en donne un dans Membres) : ${plan.newMembers.map((m) => m.name).join(", ")}`,
    );
  }
  console.log("Remplacé :");
  console.log(`  marchandises        ${current.products} → ${plan.products.length}`);
  console.log(`  mouvements de stock ${current.movements} → ${plan.movements.length}`);
  console.log(`  registre            ${current.transactions} → ${plan.transactions.length}`);
  console.log(`  annonces            ${current.announcements} → ${plan.announcements.length}`);
  for (const [k, v] of Object.entries(plan.settings)) console.log(`  réglage ${k} = ${v}`);
  console.log(`Caisse après import : ${till(plan.transactions)} septims`);
  // The old app's treasury: sales minus buybacks, plus adjustments.
  const legacyTill = data.stats?.treasury;
  if (legacyTill !== undefined) console.log(`Caisse de l'ancienne app : ${legacyTill} septims`);
  const left = Object.entries(plan.notImported).filter(([, n]) => n > 0);
  if (left.length) {
    console.log(`Pas encore de place dans la nouvelle app (restent dans le fichier) : ${left.map(([k, n]) => `${n} ${k}`).join(", ")}`);
  }
  if (plan.warnings.length) {
    console.log(`\n${plan.warnings.length} avertissement(s) :`);
    for (const w of plan.warnings) console.log(`  - ${w}`);
  }

  if (dryRun) {
    console.log("\nEssai : rien n'a été écrit.");
  } else {
    const phrase = TARGETS[target];
    const answer = confirmed ? phrase : await prompter.ask(`\nPour confirmer, tape « ${phrase} » : `);
    if (answer !== phrase) {
      console.log("Pas confirmé : rien n'a été écrit.");
    } else {
      const backup = await saveBackup(sql, target);
      console.log(`Sauvegarde de l'existant : ${backup}`);
      await write(sql, plan);
      console.log("Import terminé.");
    }
  }
} catch (error) {
  console.error(`\nÉchec : ${error.message}`);
  process.exitCode = 1;
} finally {
  prompter.close();
  await sql?.end();
}

async function saveBackup(sql, target) {
  const backup = {
    savedAt: new Date().toISOString(),
    products: await sql`select * from products order by id`,
    stockMovements: await sql`select * from stock_movements order by id`,
    transactions: await sql`select * from transactions order by id`,
    settings: await sql`select * from settings`,
    announcements: await sql`select * from announcements order by id`,
  };
  const dir = path.resolve("legacy-export");
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `sauvegarde-${target}-${backup.savedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`);
  await writeFile(out, JSON.stringify(backup, null, 2));
  return out;
}

async function write(sql, plan) {
  await sql.begin(async (tx) => {
    await tx`truncate transactions, stock_movements, products, announcements restart identity`;
    // Members are only ever added, never changed. "!" is no valid hash: no
    // sign-in until the gérant sets a password.
    const memberIds = new Map();
    for (const m of plan.newMembers) {
      const [{ id }] = await tx`
        insert into members (username, name, password_hash, role)
        values (${m.username}, ${m.name}, '!', 'employe') returning id`;
      memberIds.set(m.ref, id);
    }
    const member = (row) => ({ ...row, memberId: memberIds.get(row.memberId) ?? row.memberId });
    const ids = new Map();
    for (const p of plan.products) {
      const [{ id }] = await tx`insert into products ${tx(snake(p))} returning id`;
      ids.set(p.name, id);
    }
    for (const [key, value] of Object.entries(plan.settings)) {
      await tx`
        insert into settings (key, value) values (${key}, ${value})
        on conflict (key) do update set value = excluded.value`;
    }
    for (const chunk of chunks(plan.movements)) {
      const rows = chunk.map(({ productName, ...m }) => member({ ...m, productId: ids.get(productName) }));
      await tx`insert into stock_movements ${tx(rows.map(snake))}`;
    }
    for (const chunk of chunks(plan.transactions)) {
      const rows = chunk.map(({ productName, ...t }) =>
        member({ ...t, productId: productName ? ids.get(productName) : null }),
      );
      await tx`insert into transactions ${tx(rows.map(snake))}`;
    }
    for (const chunk of chunks(plan.announcements)) {
      await tx`insert into announcements ${tx(chunk.map(member).map(snake))}`;
    }
  });
}

function* chunks(rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}

function snake(row) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]),
  );
}
