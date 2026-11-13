import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";

/** An error message on the page, without the route announcer Next adds to every page. */
export const ALERT = "[role=alert]:not(#__next-route-announcer__)";

export const GERANT = { username: "lomone", password: "lomone-secret", name: "Lomone" };

/** Address of the comptoir, the first shop, which the tests drive. */
export const COMPTOIR = "/le-comptoir-des-chasseurs";

/** Signs in through the real sign-in form, into the comptoir. */
export async function loginAs(page: Page, username: string, password: string) {
  await page.goto(`/connexion?suite=${encodeURIComponent(COMPTOIR)}`);
  await page.getByLabel("Identifiant").fill(username);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
}

export function loginAsGerant(page: Page) {
  return loginAs(page, GERANT.username, GERANT.password);
}

/**
 * Picks a product in a product field by typing its name: "Article ou
 * marchandise" on a sale or purchase form, "Marchandise" on a stock movement.
 */
export async function pickProduct(form: Locator, name: string, label = "Marchandise") {
  const box = form.getByRole("combobox", { name: label, exact: true });
  await box.fill(name);
  await form.getByRole("option", { name, exact: true }).click();
  await expect(box).toHaveValue(name);
}

/** A name unique to this test run, so parallel tests don't collide. */
export function uniqueName(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Creates a member of the first shop (the one the app shows) straight in the database. */
export async function createMember(
  username: string,
  password: string,
  role: "gerant" | "employe" | "desactive" = "employe",
  name = username,
) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      with member as (
        insert into members (username, name, password_hash, role)
        values (${username.toLowerCase()}, ${name}, ${await hashPassword(password)}, ${role})
        returning id
      )
      insert into shop_members (shop_id, member_id, role)
      select (select min(id) from shops), id, ${role} from member`;
  } finally {
    await sql.end();
  }
}

/** Makes a gérant the super admin, straight in the database. */
export async function makeSuperAdmin(username: string) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update members set super_admin = true where username = ${username.toLowerCase()}`;
  } finally {
    await sql.end();
  }
}

/** Changes a member's role in the first shop straight in the database. */
export async function setRole(username: string, role: "gerant" | "employe" | "desactive") {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      update shop_members set role = ${role}
      where shop_id = (select min(id) from shops)
        and member_id = (select id from members where username = ${username.toLowerCase()})`;
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
    category = "Peaux",
    leather = false,
    buyQty = 1,
    bulkMin = null,
    bulkPrice = null,
  }: {
    /** null: no price, the product is "sans tarif" on that side. */
    buyPrice?: number | null;
    sellPrice?: number | null;
    stock?: number;
    unit?: string;
    /** One of the comptoir's categories (migration 0016), by name. */
    category?: "Peaux" | "Viandes et venaison" | "Autres ressources" | "Composants alchimiques";
    /** The leather: the blacksmith buys it, the Inventaire counts it apart. */
    leather?: boolean;
    /** The buy price is for this many units. */
    buyQty?: number;
    /** Wholesale: from bulkMin units, sold at bulkPrice each. */
    bulkMin?: number | null;
    bulkPrice?: number | null;
  } = {},
) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into products (shop_id, name, category_id, leather, unit, stock, buy_price, sell_price, buy_qty, bulk_min, bulk_price)
      select 1, ${name}, id, ${leather}, ${unit}, ${stock}, ${buyPrice}, ${sellPrice}, ${buyQty}, ${bulkMin}, ${bulkPrice}
      from product_categories where shop_id = 1 and name = ${category}`;
  } finally {
    await sql.end();
  }
}

/** The comptoir's privileged group, made by its migration. */
export const CITIZENS = "Citoyens d'Estemarche";

/** Gives a product of the comptoir a privileged group's buyback price, straight in the database. */
export async function setPrivilegedPrice(product: string, price: number, group = CITIZENS) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into privileged_prices (product_id, group_id, buy_price)
      select p.id, g.id, ${price} from products p
      join privileged_groups g on g.shop_id = p.shop_id and g.name = ${group}
      where p.shop_id = 1 and p.name = ${product}
      on conflict (product_id, group_id) do update set buy_price = excluded.buy_price`;
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
      insert into transactions (shop_id, kind, label, quantity, amount, member_id, created_at)
      select 1, ${kind}::transaction_kind, ${label} || ' ' || i, 1, ${amount}, m.id, ${sql.unsafe(at)}
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
      insert into announcements (shop_id, title, body, member_id, created_at)
      select 1, ${title} || ' ' || i, 'Texte ' || i, m.id, now() - interval '1 day' - i * interval '1 minute'
      from generate_series(1, ${n}::int) as i, members m
      where m.username = ${username.toLowerCase()}`;
  } finally {
    await sql.end();
  }
}

/**
 * Opens the Membres page on which a member's row is, and returns the row: the
 * accounts are paginated and sorted by name, and the other tests' members can
 * push any row past the first page.
 */
export async function memberRow(page: Page, username: string) {
  const row = page.getByTestId(`member-${username.toLowerCase()}`);
  const next = page.getByRole("navigation", { name: "Pages des comptes" }).getByRole("link", { name: "Suivant" });
  for (let n = 1; ; n++) {
    await page.goto(`/membres?page=${n}`);
    await expect(page.getByRole("heading", { name: "Comptes" })).toBeVisible();
    if ((await row.count()) > 0) return row;
    if ((await next.count()) === 0) throw new Error(`Aucun compte « ${username} » dans Membres.`);
  }
}

/**
 * Drags an item by its handle onto the top of another, moving the mouse in
 * small steps as a hand would: the list only reorders while the pointer moves.
 */
export async function dragAbove(page: Page, handle: Locator, target: Locator) {
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 2, { steps: 12 });
  await page.mouse.up();
}
