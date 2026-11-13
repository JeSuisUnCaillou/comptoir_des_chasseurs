// Loads an export of the old app (scripts/legacy/export.mjs) into a database
// of the new one, replacing its merchandise, stock history, register, board
// and suppliers. Members are never changed: the old app's authors are matched
// to them by name, and those with no account get one, without a password.
// --seulement=fournisseurs replaces the suppliers alone, matching what they
// sell to the target's merchandise by name, and leaves everything else.
//
//   node scripts/legacy/import.mjs <export.json> --cible=preview|prod
//     [--base=<url postgres>] [--oui] [--essai] [--seulement=fournisseurs]
//
// The database address is asked unless given with --base. --oui confirms
// without asking; otherwise the target's phrase must be typed. --essai shows what would be
// written and stops. Before writing, the current data is saved to
// legacy-export/, and everything is written in one transaction.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { connectionOptions } from "../../lib/db/url.mjs";
import { key, mapLegacy, till } from "./map.mjs";
import { createPrompter } from "./prompt.mjs";

const TARGETS = { preview: "écraser la preview", prod: "écraser la prod", local: "écraser" };

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const target = args.find((a) => a.startsWith("--cible="))?.slice("--cible=".length);
const dryRun = args.includes("--essai");
const givenUrl = args.find((a) => a.startsWith("--base="))?.slice("--base=".length);
const confirmed = args.includes("--oui");
const only = args.find((a) => a.startsWith("--seulement="))?.slice("--seulement=".length);
const suppliersOnly = only === "fournisseurs";

if (!file || !TARGETS[target] || (only !== undefined && !suppliersOnly)) {
  console.error(
    "Usage : node scripts/legacy/import.mjs <export.json> --cible=preview|prod [--base=<url>] [--oui] [--essai] [--seulement=fournisseurs]",
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

  // The old app was the comptoir alone: it is imported into the first shop,
  // and only while there is no other shop, since the import empties the tables.
  const [{ shops }] = await sql`select count(*)::int as shops from shops`;
  if (shops > 1) throw new Error("La base héberge plusieurs boutiques : la reprise viderait les autres.");
  const members = await sql`
    select m.id, m.username, m.name, coalesce(s.role, 'employe') as role
    from members m left join shop_members s on s.member_id = m.id and s.shop_id = 1`;
  const plan = mapLegacy(data, members);
  const [current] = await sql`
    select (select count(*) from products)::int as products,
           (select count(*) from stock_movements)::int as movements,
           (select count(*) from transactions)::int as transactions,
           (select count(*) from announcements)::int as announcements,
           (select count(*) from suppliers)::int as suppliers`;
  if (suppliersOnly) {
    // Only the target's merchandise can be offered: the rest is left out.
    const known = new Map((await sql`select id, name from products`).map((p) => [key(p.name), p.name]));
    for (const s of plan.suppliers) {
      s.offers = s.offers.filter((o) => {
        if (known.has(key(o.productName))) {
          o.productName = known.get(key(o.productName));
          return true;
        }
        plan.warnings.push(`Offre de ${s.name} ignorée : ${o.productName} n'existe pas dans la base cible.`);
        return false;
      });
    }
  }

  console.log(`\nCible : ${target.toUpperCase()}, ${where.username}@${where.host}${where.pathname}`);
  console.log(`Membres gardés : ${members.length}`);
  if (plan.newMembers.length && !suppliersOnly) {
    console.log(
      `Comptes créés, sans mot de passe (le gérant leur en donne un dans Membres) : ${plan.newMembers.map((m) => m.name).join(", ")}`,
    );
  }
  console.log(suppliersOnly ? "Remplacé (rien d'autre ne bouge) :" : "Remplacé :");
  if (!suppliersOnly) {
    console.log(`  marchandises        ${current.products} → ${plan.products.length}`);
    console.log(`  mouvements de stock ${current.movements} → ${plan.movements.length}`);
    console.log(`  registre            ${current.transactions} → ${plan.transactions.length}`);
    console.log(`  annonces            ${current.announcements} → ${plan.announcements.length}`);
  }
  console.log(`  fournisseurs        ${current.suppliers} → ${plan.suppliers.length}`);
  if (!suppliersOnly) {
    for (const [k, v] of Object.entries(plan.settings)) console.log(`  réglage ${k} = ${v}`);
    console.log(`Caisse après import : ${till(plan.transactions)} septims`);
    // The old app's treasury: sales minus buybacks, plus adjustments.
    const legacyTill = data.stats?.treasury;
    if (legacyTill !== undefined) console.log(`Caisse de l'ancienne app : ${legacyTill} septims`);
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
      await (suppliersOnly ? writeSuppliers(sql, plan.suppliers) : write(sql, plan));
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
    suppliers: await sql`select * from suppliers order by id`,
    supplierOffers: await sql`select * from supplier_offers order by id`,
  };
  const dir = path.resolve("legacy-export");
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `sauvegarde-${target}-${backup.savedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`);
  await writeFile(out, JSON.stringify(backup, null, 2));
  return out;
}

async function write(sql, plan) {
  await sql.begin(async (tx) => {
    await tx`truncate transactions, stock_movements, supplier_offers, suppliers, privileged_prices, products, announcements restart identity`;
    // Members are only ever added, never changed. "!" is no valid hash: no
    // sign-in until the gérant sets a password.
    const memberIds = new Map();
    for (const m of plan.newMembers) {
      const [{ id }] = await tx`
        insert into members (username, name, password_hash, role)
        values (${m.username}, ${m.name}, '!', 'employe') returning id`;
      await tx`insert into shop_members (shop_id, member_id, role) values (1, ${id}, 'employe')`;
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
        insert into settings (shop_id, key, value) values (1, ${key}, ${value})
        on conflict (shop_id, key) do update set value = excluded.value`;
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
    await insertSuppliers(tx, plan.suppliers);
  });
}

async function writeSuppliers(sql, suppliers) {
  await sql.begin(async (tx) => {
    await tx`truncate supplier_offers, suppliers restart identity`;
    await insertSuppliers(tx, suppliers);
  });
}

/** Inserts suppliers and their offers, matched to products by name. */
async function insertSuppliers(tx, suppliers) {
  for (const { offers, ...s } of suppliers) {
    const [{ id }] = await tx`insert into suppliers ${tx(snake(s))} returning id`;
    for (const o of offers) {
      await tx`
        insert into supplier_offers (supplier_id, product_id, price, qty)
        select ${id}, p.id, ${o.price}, ${o.qty} from products p where p.shop_id = 1 and p.name = ${o.productName}`;
    }
  }
}

function* chunks(rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) yield rows.slice(i, i + size);
}

/** A row of the plan as columns, in the first shop: the old app was the comptoir alone. */
function snake(row) {
  return {
    ...Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v]),
    ),
    shop_id: 1,
  };
}
