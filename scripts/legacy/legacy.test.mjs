// Drives both legacy scripts as Caillou would: answers their questions on
// stdin, against a fake old app and a throwaway database next to the e2e one.
//
//   node --test scripts/legacy/
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import { after, before, test } from "node:test";
import postgres from "postgres";

const ROOT = path.resolve(import.meta.dirname, "../..");
const USER = "einar";
const PASSWORD = "mot de passe de test";
const TOKEN = "jeton-de-test";

// 450 transactions over 9 days: more than one call of the old API (200 max).
const DAYS = 9;
const transactions = Array.from({ length: 450 }, (_, i) => ({
  id: i + 1,
  type: i % 3 === 0 ? "purchase" : "sale",
  item_name: i % 2 ? "Biche" : "Venaison",
  quantity: 2,
  amount: i % 3 === 0 ? "4" : "6",
  customer_name: "Ulfric",
  notes: null,
  employee_name: i % 5 ? "Einar le Rouge" : "Inconnu",
  created_at: new Date(Date.UTC(2026, 9, 1 + (i % DAYS), 12)).toISOString(),
  voided_at: i === 7 ? "2026-10-10T10:00:00Z" : null,
  void_reason: i === 7 ? "Erreur de saisie" : null,
}));
const legacy = {
  "/api/stats": { net_operations: "1194", treasury: "1144" },
  "/api/users": { users: [{ id: 1, username: "einar", display_name: "Einar le Rouge", role: "manager" }] },
  "/api/inventory": {
    items: [
      { id: 1, name: "Biche", category: "skin", unit: "peau", quantity: 12 },
      { id: 2, name: "Cuir", category: "leather", unit: "cuir", quantity: 30 },
      { id: 3, name: "Venaison", category: "other", unit: "pièce", quantity: 140 },
      { id: 4, name: "Lanterne", category: "other", unit: "pièce", quantity: -1 },
    ],
  },
  "/api/inventory/movements": {
    movements: [
      { item_name: "Biche", delta: 12, after_qty: 12, reason: "Chasse", employee_name: "Einar le Rouge", created_at: "2026-10-01T08:00:00Z" },
      { item_name: "Fantôme", delta: 1, after_qty: 1, reason: "?", employee_name: "Einar le Rouge", created_at: "2026-10-01T08:00:00Z" },
    ],
  },
  "/api/tariffs": {
    skins: [{ id: 1, name: "Biche", skins_needed: 4, leather_produced: 2, buy_price: 2, sell_price: 3, blacksmith_price: 3 }],
    leather: { buy: "4", sell: "6", blacksmith: "7" },
  },
  "/api/tariffs/meats": {
    products: [
      { id: 1, item_id: 3, name: "Venaison", unit: "pièce", product_kind: "meat", sale_lot_qty: 1, sale_lot_price: 3, buy_lot_qty: 1, buy_lot_price: 1, bulk_from_qty: 200, bulk_unit_price: 2 },
    ],
  },
  "/api/suppliers": { suppliers: [{ id: 1, name: "Ferme", offers: [] }] },
  "/api/treasury/adjustments": { adjustments: [{ amount: "-50", description: "Salaires", manager_name: "Einar le Rouge", created_at: "2026-10-05T00:00:00Z" }] },
  "/api/missives/board": {
    posts: [
      { id: 1, title: "Bienvenue", body: "Le comptoir ouvre.", fastener: "axe", author_name: "Einar le Rouge", created_at: "2026-10-02T09:00:00Z" },
      { id: 2, title: "Chasse", body: "Ours au nord.", fastener: "meat", author_name: "Inconnu", created_at: "2026-10-03T09:00:00Z" },
      { id: 3, title: "Forge", body: "Cuir livré.", fastener: "knife", author_name: "Ældis la Rapide", created_at: "2026-10-04T09:00:00Z" },
      { id: 4, title: "Doublon", body: "…", fastener: "knife", author_name: "Einar !", created_at: "2026-10-04T10:00:00Z" },
    ],
  },
};

// How the fake API pages transactions; the real cap and `to` bound are guesses.
const api = { cap: 200, toExclusive: false };
let server;
let baseUrl;
let dbUrl;
let admin;
// The scripts write to legacy-export/ in their working directory: a temporary one here.
let work;
let OUT;

before(async () => {
  work = await mkdtemp(path.join(os.tmpdir(), "comptoir-legacy-"));
  OUT = path.join(work, "legacy-export");
  server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { username, password } = JSON.parse(body);
        if (username !== USER || password !== PASSWORD) return send(401, { error: "Identifiants invalides." });
        send(200, { token: TOKEN, user: { username: USER, display_name: "Einar le Rouge", role: "manager" } });
      });
      return;
    }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "Connexion requise." });
    if (url.pathname === "/api/transactions") {
      // The real API refuses an empty type filter.
      if (url.searchParams.has("type") && !["sale", "purchase"].includes(url.searchParams.get("type"))) {
        return send(400, { error: "Type invalide." });
      }
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const day = (t) => t.created_at.slice(0, 10);
      const rows = transactions
        .filter((t) => (!from || day(t) >= from) && (!to || (api.toExclusive ? day(t) < to : day(t) <= to)))
        .toReversed()
        .slice(0, api.cap);
      return send(200, { transactions: rows });
    }
    if (url.pathname === "/api/einar") return send(403, { error: "Réservé." });
    if (legacy[url.pathname]) return send(200, legacy[url.pathname]);
    send(404, { error: "Route introuvable." });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // A database of its own: the import empties the merchandise the e2e tests use.
  const testUrl = process.env.DATABASE_URL;
  assert.ok(testUrl, "DATABASE_URL est requis.");
  const url = new URL(testUrl);
  url.pathname = "/comptoir_import_test";
  dbUrl = url.toString();
  const server0 = postgres(testUrl, { max: 1, onnotice: () => {} });
  try {
    await server0.unsafe("drop database if exists comptoir_import_test with (force)");
    await server0.unsafe("create database comptoir_import_test");
  } finally {
    await server0.end();
  }
  await run(["scripts/migrate.mjs"], "", { DATABASE_URL: dbUrl }, ROOT);
  admin = postgres(dbUrl, { max: 1, onnotice: () => {} });
  await admin`
    insert into members (username, name, password_hash, role) values
      ('lomone', 'Lomone', 'x', 'gerant'),
      ('einar', 'Einar', 'x', 'employe')`;
});

after(async () => {
  server?.close();
  await admin?.end();
  if (work) await rm(work, { recursive: true, force: true });
});

test("l'export refuse de mauvais identifiants", async () => {
  const { code, output } = await run(["scripts/legacy/export.mjs"], `${baseUrl}\n${USER}\nfaux\n`);
  assert.equal(code, 1);
  assert.match(output, /401 Identifiants invalides/);
  assert.doesNotMatch(output, /faux/, "le mot de passe n'est jamais affiché");
});

test("export puis import, sans toucher aux membres", async () => {
  const exported = await run(["scripts/legacy/export.mjs"], `${baseUrl}\n${USER}\n${PASSWORD}\n`);
  assert.equal(exported.code, 0, exported.output);
  assert.doesNotMatch(exported.output, new RegExp(PASSWORD));
  assert.match(exported.output, /✗ \/api\/einar : 403/);
  const file = path.join(OUT, (await readdir(OUT)).find((f) => f.startsWith("ancienne-app-")));
  const data = JSON.parse(await readFile(file, "utf8"));
  assert.equal(data.transactions.length, 450, "toutes les pages de transactions");
  assert.doesNotMatch(JSON.stringify(data), new RegExp(TOKEN));

  // A trial writes nothing.
  const trial = await run(["scripts/legacy/import.mjs", file, "--cible=local", "--essai"], `${dbUrl}\n`);
  assert.equal(trial.code, 0, trial.output);
  assert.match(trial.output, /registre\s+0 → 451/);
  assert.match(trial.output, /annonces\s+0 → 4/);
  assert.match(trial.output, /rien n'a été écrit/);
  assert.equal((await admin`select count(*)::int as n from transactions`)[0].n, 0);

  // A wrong confirmation writes nothing either.
  const refused = await run(["scripts/legacy/import.mjs", file, "--cible=local"], `${dbUrl}\nnon\n`);
  assert.match(refused.output, /Pas confirmé/);
  assert.equal((await admin`select count(*)::int as n from transactions`)[0].n, 0);

  // Everything on one line: nothing is asked, and the URL is never printed.
  const imported = await run(["scripts/legacy/import.mjs", file, "--cible=local", `--base=${dbUrl}`, "--oui"], "");
  assert.equal(imported.code, 0, imported.output);
  assert.match(imported.output, /Import terminé/);
  assert.match(imported.output, /Caisse après import : 1144 septims\nCaisse de l'ancienne app : 1144 septims/);
  assert.match(imported.output, /1 fournisseurs/);
  assert.match(imported.output, /Mouvement de stock ignoré : marchandise inconnue \(Fantôme\)/);
  assert.match(imported.output, /Comptes créés, sans mot de passe .*: Inconnu/);
  assert.doesNotMatch(imported.output, /postgres:postgres/, "l'URL n'est jamais affichée en entier");

  // Existing accounts untouched; the unknown author gets one he cannot sign in with.
  const members = await admin`select username, name, role, password_hash from members order by id`;
  assert.deepEqual(
    members.map((m) => ({ ...m })),
    [
      { username: "lomone", name: "Lomone", role: "gerant", password_hash: "x" },
      { username: "einar", name: "Einar", role: "employe", password_hash: "x" },
      { username: "inconnu", name: "Inconnu", role: "employe", password_hash: "!" },
      { username: "aeldis.la.rapide", name: "Ældis la Rapide", role: "employe", password_hash: "!" },
      { username: "einar-2", name: "Einar !", role: "employe", password_hash: "!" },
    ],
  );

  const products = await admin`select * from products order by name`;
  assert.deepEqual(products.map((p) => p.name), ["Biche", "Cuir", "Lanterne", "Venaison"]);
  const biche = products.find((p) => p.name === "Biche");
  assert.equal(biche.category, "peau");
  assert.equal(biche.stock, 12);
  assert.equal(biche.hides_per_batch, 4);
  const venaison = products.find((p) => p.name === "Venaison");
  assert.equal(venaison.category, "viande");
  assert.equal(venaison.bulk_min, 200);
  assert.equal(products.find((p) => p.name === "Lanterne").stock, 0);
  const [{ value: smith }] = await admin`select value from settings where key = 'prix_forgeron_cuir'`;
  assert.equal(smith, 7);

  const [counts] = await admin`
    select count(*)::int as n,
           count(*) filter (where cancelled_at is not null)::int as cancelled,
           count(*) filter (where member_id = (select id from members where username = 'einar'))::int as by_einar
    from transactions`;
  assert.equal(counts.n, 451, "450 transactions et un ajustement");
  assert.equal(counts.cancelled, 1);
  assert.equal(counts.by_einar, 361, "360 transactions et l'ajustement");
  const [salaries] = await admin`
    select kind, amount, (select username from members where id = member_id) as author
    from transactions where label = 'Ajustement de trésorerie'`;
  assert.deepEqual({ ...salaries }, { kind: "sortie", amount: 50, author: "einar" });
  const [{ n: moves }] = await admin`select count(*)::int as n from stock_movements`;
  assert.equal(moves, 1);

  const notices = await admin`
    select title, body, pin, (select username from members where id = member_id) as author
    from announcements order by created_at`;
  assert.deepEqual(notices.map((n) => ({ ...n })), [
    { title: "Bienvenue", body: "Le comptoir ouvre.", pin: "hache", author: "einar" },
    { title: "Chasse", body: "Ours au nord.", pin: "viande", author: "inconnu" },
    { title: "Forge", body: "Cuir livré.", pin: "couteau", author: "aeldis.la.rapide" },
    { title: "Doublon", body: "…", pin: "couteau", author: "einar-2" },
  ]);

  const backups = (await readdir(OUT)).filter((f) => f.startsWith("sauvegarde-local-"));
  assert.equal(backups.length, 1, "l'existant est sauvegardé avant d'écrire");
});

test("l'export récupère tout le registre, quel que soit le découpage de l'API", async () => {
  Object.assign(api, { cap: 100, toExclusive: true });
  try {
    // Everything on the command line: nothing is asked, the password isn't printed.
    const { code, output } = await run(["scripts/legacy/export.mjs", baseUrl, USER, PASSWORD], "");
    assert.equal(code, 0, output);
    assert.doesNotMatch(output, /Identifiant :|Mot de passe :/);
    assert.doesNotMatch(output, new RegExp(PASSWORD));
    const file = output.match(/Données écrites dans (.+)/)[1].trim();
    const data = JSON.parse(await readFile(file, "utf8"));
    assert.equal(data.transactions.length, 450);
  } finally {
    Object.assign(api, { cap: 200, toExclusive: false });
  }
});

/** Runs a script of the repo, feeding `input` on stdin. */
function run([script, ...args], input, env = {}, cwd = work) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, script), ...args], {
      cwd,
      env: { ...process.env, ...env },
    });
    let output = "";
    child.stdout.on("data", (c) => (output += c));
    child.stderr.on("data", (c) => (output += c));
    child.on("close", (code) => resolve({ code, output }));
    child.stdin.end(input);
  });
}
