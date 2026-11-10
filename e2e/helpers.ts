import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";

export const GERANT = { username: "lomone", password: "lomone-secret", name: "Lomone" };

/** Signs in through the real sign-in form. */
export async function loginAs(page: Page, username: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(username);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Entrer au comptoir" }).click();
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
}

export function loginAsGerant(page: Page) {
  return loginAs(page, GERANT.username, GERANT.password);
}

/** Picks a product in the "Article ou marchandise" field of a sale or purchase form, by typing its name. */
export async function pickProduct(form: Locator, name: string) {
  const box = form.getByRole("combobox", { name: "Article ou marchandise" });
  await box.fill(name);
  await form.getByRole("option", { name, exact: true }).click();
  await expect(box).toHaveValue(name);
}

/** A name unique to this test run, so parallel tests don't collide. */
export function uniqueName(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates a member straight in the database. */
export async function createMember(
  username: string,
  password: string,
  role: "gerant" | "employe" | "desactive" = "employe",
  name = username,
) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into members (username, name, password_hash, role)
      values (${username.toLowerCase()}, ${name}, ${await hashPassword(password)}, ${role})`;
  } finally {
    await sql.end();
  }
}

/** Changes a member's role straight in the database. */
export async function setRole(username: string, role: "gerant" | "employe" | "desactive") {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update members set role = ${role} where username = ${username.toLowerCase()}`;
  } finally {
    await sql.end();
  }
}

export async function newEmployeePage(browser: Browser, prefix: string) {
  const username = uniqueName(prefix).toLowerCase();
  await createMember(username, "mot-de-passe", "employe");
  const page = await (await browser.newContext()).newPage();
  await loginAs(page, username, "mot-de-passe");
  return { page, username };
}

/** Creates a product straight in the database, with its tariff and stock. */
export async function createProduct(
  name: string,
  {
    buyPrice = 2,
    sellPrice = 3,
    stock = 0,
    unit = "peau",
    category = "peau",
  }: {
    buyPrice?: number;
    sellPrice?: number;
    stock?: number;
    unit?: string;
    category?: "peau" | "cuir" | "viande" | "ressource" | "autre";
  } = {},
) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into products (name, category, unit, stock, buy_price, sell_price)
      values (${name}, ${category}, ${unit}, ${stock}, ${buyPrice}, ${sellPrice})`;
  } finally {
    await sql.end();
  }
}

/**
 * Writes `n` off-stock sales (or buybacks) by a member straight in the
 * database, dated yesterday so they never push other tests' fresh lines off
 * the first page.
 */
export async function createTransactions(
  username: string,
  n: number,
  {
    at = "now() - interval '1 day'",
    amount = 1,
    label = "Article de test",
    kind = "vente" as "vente" | "rachat",
  } = {},
) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into transactions (kind, label, quantity, amount, member_id, created_at)
      select ${kind}::transaction_kind, ${label} || ' ' || i, 1, ${amount}, m.id, ${sql.unsafe(at)}
      from generate_series(1, ${n}::int) as i, members m
      where m.username = ${username.toLowerCase()}`;
  } finally {
    await sql.end();
  }
}

/**
 * Pins `n` parchments by a member straight in the database, dated yesterday so
 * they never push other tests' fresh ones off the first page.
 */
export async function createAnnouncements(username: string, n: number, title = "Annonce de test") {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into announcements (title, body, member_id, created_at)
      select ${title} || ' ' || i, 'Texte ' || i, m.id, now() - interval '1 day' - i * interval '1 minute'
      from generate_series(1, ${n}::int) as i, members m
      where m.username = ${username.toLowerCase()}`;
  } finally {
    await sql.end();
  }
}
