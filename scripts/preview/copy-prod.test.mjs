// Drives the copy of production into the preview as Caillou would: answers its
// questions on stdin, between two throwaway databases next to the e2e one.
//
//   node --test scripts/preview/
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { after, before, test } from "node:test";
import postgres from "postgres";

const ROOT = path.resolve(import.meta.dirname, "../..");
let prodUrl;
let previewUrl;
let prod;
let preview;

before(async () => {
  const testUrl = process.env.DATABASE_URL;
  assert.ok(testUrl, "DATABASE_URL est requis.");
  const server = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    for (const name of ["comptoir_copie_prod_test", "comptoir_copie_preview_test"]) {
      await server.unsafe(`drop database if exists ${name} with (force)`);
      await server.unsafe(`create database ${name}`);
    }
  } finally {
    await server.end();
  }
  const at = (name) => Object.assign(new URL(testUrl), { pathname: `/${name}` }).toString();
  prodUrl = at("comptoir_copie_prod_test");
  previewUrl = at("comptoir_copie_preview_test");
  for (const url of [prodUrl, previewUrl]) {
    const migrated = await run(["scripts/migrate.mjs"], "", { DATABASE_URL: url });
    assert.equal(migrated.code, 0, migrated.output);
  }
  const seeded = await run(["scripts/seed-preview.mjs"], "", { DATABASE_URL: previewUrl, VERCEL_ENV: "preview" });
  assert.equal(seeded.code, 0, seeded.output);

  prod = postgres(prodUrl, { max: 1, onnotice: () => {} });
  preview = postgres(previewUrl, { max: 1, onnotice: () => {} });
  const [boss] = await prod`
    insert into members (username, name, password_hash, super_admin)
    values ('patron', 'Le Patron', 'scrypt$x$y', true) returning id`;
  await prod`insert into shop_members (shop_id, member_id, role) values (1, ${boss.id}, 'gerant')`;
  const [product] = await prod`
    insert into products (shop_id, name, category_id, stock, sell_price)
    select 1, 'Peau de troll', id, 7, 30 from product_categories where shop_id = 1 and hides
    order by id limit 1 returning id`;
  const [sale] = await prod`
    insert into transactions (shop_id, kind, product_id, label, quantity, amount, counterparty, member_id)
    values (1, 'vente', ${product.id}, 'Peau de troll', 2, 60, 'Brynjolf', ${boss.id}) returning id`;
  await prod`
    insert into stock_movements (shop_id, product_id, delta, stock_after, member_id, reason, transaction_id)
    values (1, ${product.id}, -2, 7, ${boss.id}, 'Vente · Brynjolf', ${sale.id})`;
});

after(async () => {
  await prod?.end();
  await preview?.end();
});

const snapshot = async (sql) => ({
  members: (await sql`select username, name, super_admin from members order by username`).map((r) => ({ ...r })),
  products: (await sql`select name, stock from products order by name`).map((r) => ({ ...r })),
  sales: (await sql`select label, counterparty, amount from transactions order by id`).map((r) => ({ ...r })),
});

test("refuse des adresses inversées", async () => {
  const before = await snapshot(prod);
  const { code, output } = await run(["scripts/preview/copy-prod.mjs"], `${previewUrl}\n${prodUrl}\n`);
  assert.equal(code, 1);
  assert.match(output, /n'a pas le gérant Lomone des previews/);
  assert.deepEqual(await snapshot(prod), before);
});

test("refuse une preview en retard sur les migrations de la prod", async () => {
  const [last] = await preview`
    delete from drizzle.__drizzle_migrations
    where created_at = (select max(created_at) from drizzle.__drizzle_migrations) returning hash, created_at`;
  try {
    const { code, output } = await run(["scripts/preview/copy-prod.mjs"], `${prodUrl}\n${previewUrl}\n`);
    assert.equal(code, 1);
    assert.match(output, /La preview n'a pas 1 migration\(s\) de la prod/);
  } finally {
    await preview`insert into drizzle.__drizzle_migrations (hash, created_at) values (${last.hash}, ${last.created_at})`;
  }
});

test("accepte une migration renumérotée, déjà passée sur la preview sous une autre date", async () => {
  const [last] = await preview`
    update drizzle.__drizzle_migrations set created_at = created_at - 1000
    where created_at = (select max(created_at) from drizzle.__drizzle_migrations) returning id`;
  try {
    const { code, output } = await run(["scripts/preview/copy-prod.mjs", "--essai"], `${prodUrl}\n${previewUrl}\n`);
    assert.equal(code, 0, output);
  } finally {
    await preview`update drizzle.__drizzle_migrations set created_at = created_at + 1000 where id = ${last.id}`;
  }
});

test("l'essai et un refus ne changent rien", async () => {
  const before = await snapshot(preview);
  const trial = await run(["scripts/preview/copy-prod.mjs", "--essai"], `${prodUrl}\n${previewUrl}\n`);
  assert.equal(trial.code, 0, trial.output);
  assert.match(trial.output, /products : \d+/);
  assert.match(trial.output, /Essai : rien n'a été écrit/);
  const refused = await run(["scripts/preview/copy-prod.mjs"], `${prodUrl}\n${previewUrl}\nnon\n`);
  assert.match(refused.output, /Pas confirmé/);
  assert.deepEqual(await snapshot(preview), before);
});

test("copie la prod dans la preview, garde Lomone et Aela, sans exemples ensuite", async () => {
  const prodBefore = await snapshot(prod);
  const { code, output } = await run(
    ["scripts/preview/copy-prod.mjs"],
    `${prodUrl}\n${previewUrl}\nécraser la preview\n`,
  );
  assert.equal(code, 0, output);
  assert.match(output, /Copie terminée/);
  assert.deepEqual(await snapshot(prod), prodBefore, "la prod ne bouge pas");

  const copy = await snapshot(preview);
  assert.deepEqual(copy.products, prodBefore.products);
  assert.deepEqual(copy.sales, prodBefore.sales);
  assert.deepEqual(
    copy.members.map((m) => m.username),
    [...prodBefore.members.map((m) => m.username), "aela", "lomone"].sort(),
  );
  // The prod's super admin stays the only one.
  assert.deepEqual(copy.members.filter((m) => m.super_admin).map((m) => m.username), ["patron"]);
  const gerants = await preview`
    select m.username from shop_members s join members m on m.id = s.member_id
    where s.shop_id = 1 and s.role = 'gerant' order by m.username`;
  assert.deepEqual(gerants.map((g) => g.username), ["aela", "lomone", "patron"]);

  // New rows get fresh ids after the copied ones.
  await preview`
    insert into products (shop_id, name, category_id, stock)
    select 1, 'Nouvelle marchandise', id, 1 from product_categories where shop_id = 1 order by id limit 1`;

  // The next preview build adds the accounts only, no sample on the real data.
  const seeded = await run(["scripts/seed-preview.mjs"], "", { DATABASE_URL: previewUrl, VERCEL_ENV: "preview" });
  assert.equal(seeded.code, 0, seeded.output);
  assert.match(seeded.output, /Copie de la prod : pas d'exemples ajoutés/);
  const [{ samples }] = await preview`select count(*)::int as samples from suppliers where name = 'Roy'`;
  assert.equal(samples, 0);

  // A second copy replaces the first.
  const again = await run(["scripts/preview/copy-prod.mjs", "--oui"], `${prodUrl}\n${previewUrl}\n`);
  assert.equal(again.code, 0, again.output);
  assert.deepEqual((await snapshot(preview)).products, prodBefore.products);
});

function run([script, ...args], input, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, script), ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
    });
    let output = "";
    child.stdout.on("data", (c) => (output += c));
    child.stderr.on("data", (c) => (output += c));
    child.on("close", (code) => resolve({ code, output }));
    child.stdin.end(input);
  });
}
