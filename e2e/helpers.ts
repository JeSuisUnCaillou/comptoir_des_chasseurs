import { expect, type Browser, type Page } from "@playwright/test";
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

export async function newEmployeePage(browser: Browser, prefix: string) {
  const username = uniqueName(prefix).toLowerCase();
  await createMember(username, "mot-de-passe", "employe");
  const page = await (await browser.newContext()).newPage();
  await loginAs(page, username, "mot-de-passe");
  return { page, username };
}
