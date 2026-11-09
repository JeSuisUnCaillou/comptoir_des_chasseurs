// Fetches everything the old comptoir app knows and writes it, as returned by
// its API, to a JSON file in legacy-export/ (ignored by git). Nothing is
// written to any database: scripts/legacy/import.mjs does that from the file.
//
//   node scripts/legacy/export.mjs
//
// The address, sign-in name and password are asked at run time. The old app
// uses a self-signed certificate, so certificate checks are off for that one
// host only.
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { createPrompter } from "./prompt.mjs";

const PAGE_LIMIT = 200; // most transactions the old API returns per call
const FIRST_DAY = "2000-01-01";

const prompter = createPrompter();
try {
  const base = new URL(await prompter.ask("Adresse de l'ancienne app (https://…) : "));
  const username = await prompter.ask("Identifiant : ");
  const password = await prompter.ask("Mot de passe : ", { hidden: true });
  prompter.close();

  const api = client(base);
  const { token, user } = await api("POST", "/api/auth/login", { body: { username, password } });
  if (!token) throw new Error("La connexion n'a pas renvoyé de jeton.");
  console.log(`Connecté en tant que ${user?.display_name ?? user?.username ?? "?"} (${user?.role ?? "?"}).`);
  const get = (route) => api("GET", route, { token });

  const data = { exportedAt: new Date().toISOString(), exportedBy: user ?? null };
  const errors = {};
  // Routes some accounts may not reach: noted, the export goes on.
  const routes = {
    stats: "/api/stats",
    users: "/api/users",
    inventory: "/api/inventory",
    movements: "/api/inventory/movements",
    tariffs: "/api/tariffs",
    meats: "/api/tariffs/meats",
    suppliers: "/api/suppliers",
    treasury: "/api/treasury/adjustments",
    einar: "/api/einar",
    board: "/api/missives/board",
  };
  for (const [key, route] of Object.entries(routes)) {
    try {
      data[key] = await get(route);
      console.log(`✓ ${route}`);
    } catch (error) {
      errors[key] = error.message;
      data[key] = null;
      console.log(`✗ ${route} : ${error.message}`);
    }
  }
  data.transactions = await allTransactions(get);
  console.log(`✓ /api/transactions (${data.transactions.length})`);
  data.errors = errors;

  for (const [key, list] of [
    ["movements", data.movements?.movements],
    ["treasury", data.treasury?.adjustments],
  ]) {
    if (Array.isArray(list) && [50, 100, 200, 500, 1000].includes(list.length)) {
      console.log(`⚠ ${key} : exactement ${list.length} lignes, l'ancienne app en a peut-être tronqué.`);
    }
  }

  const dir = path.resolve("legacy-export");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `ancienne-app-${stamp()}.json`);
  await writeFile(file, JSON.stringify(data, null, 2));
  console.log(`\nDonnées écrites dans ${file}`);
} catch (error) {
  console.error(`\nÉchec : ${error.message}`);
  process.exitCode = 1;
} finally {
  prompter.close();
}

/** JSON calls to the old API. Errors carry the API's own message. */
function client(base) {
  const secure = base.protocol === "https:";
  const agent = secure
    ? new https.Agent({ rejectUnauthorized: false }) // self-signed, this host only
    : new http.Agent();
  return (method, route, { body, token } = {}) =>
    new Promise((resolve, reject) => {
      const url = new URL(route, base);
      const payload = body ? JSON.stringify(body) : undefined;
      const request = (secure ? https : http).request(
        url,
        {
          method,
          agent,
          headers: {
            Accept: "application/json",
            ...(payload && { "Content-Type": "application/json" }),
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          timeout: 30_000,
        },
        (response) => {
          let text = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => (text += chunk));
          response.on("end", () => {
            let json;
            try {
              json = JSON.parse(text);
            } catch {
              return reject(new Error(`${method} ${route} : réponse non JSON (${response.statusCode})`));
            }
            if (response.statusCode >= 400) {
              return reject(new Error(`${response.statusCode} ${json?.error ?? ""}`.trim()));
            }
            resolve(json);
          });
        },
      );
      request.on("timeout", () => request.destroy(new Error(`${method} ${route} : délai dépassé`)));
      request.on("error", reject);
      request.end(payload);
    });
}

/**
 * Every transaction. The API caps a call (200 rows, read in its front end),
 * so a date range is cut in halves until each half comes back under the cap.
 * The cap actually seen on the unfiltered call is used if it is lower, and
 * whether the API counts the `to` day in is checked on a known row.
 */
async function allTransactions(get) {
  const byId = new Map();
  const { transactions: first = [] } = await get("/api/transactions");
  first.forEach((t) => byId.set(t.id, t));
  if (first.length === 0) return [];
  const limit = Math.min(PAGE_LIMIT, first.length);

  const fetchRange = async (from, to) => {
    const query = new URLSearchParams({ type: "", from, to: toExclusive ? nextDay(to) : to });
    const { transactions } = await get(`/api/transactions?${query}`);
    return transactions ?? [];
  };
  // A row from the middle of a UTC day, to stay clear of time-zone edges.
  const probe = first.find((t) => {
    const hour = new Date(t.created_at).getUTCHours();
    return hour >= 4 && hour <= 20;
  }) ?? first[0];
  const probeDay = String(probe.created_at).slice(0, 10);
  let toExclusive = false;
  toExclusive = !(await fetchRange(probeDay, probeDay)).some((t) => t.id === probe.id);

  const visit = async (from, to) => {
    const rows = await fetchRange(from, to);
    // A day of slack: the old app may cut days in Paris time, not UTC.
    const outside = rows.find((t) => {
      const day = String(t.created_at).slice(0, 10);
      return day < previousDay(from) || day > nextDay(to);
    });
    if (outside) {
      throw new Error("Le filtre par dates des transactions ne répond pas comme prévu : export incomplet.");
    }
    rows.forEach((t) => byId.set(t.id, t));
    if (rows.length < limit) return;
    if (from === to) {
      console.log(`⚠ Au moins ${limit} transactions le ${from} : certaines peuvent manquer.`);
      return;
    }
    const middle = midDay(from, to);
    await visit(from, middle);
    await visit(nextDay(middle), to);
  };
  await visit(FIRST_DAY, nextDay(today()));
  return [...byId.values()].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function nextDay(day) {
  return new Date(Date.parse(day) + 86_400_000).toISOString().slice(0, 10);
}
function previousDay(day) {
  return new Date(Date.parse(day) - 86_400_000).toISOString().slice(0, 10);
}
function midDay(from, to) {
  const days = Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000 / 2);
  return new Date(Date.parse(from) + days * 86_400_000).toISOString().slice(0, 10);
}
function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}
