import { expect, test, type Locator } from "@playwright/test";
import postgres from "postgres";
import { GERANT, loginAsGerant, uniqueName } from "./helpers";

/**
 * A shop of its own with Biche and Loup, priced and in stock, Biche bearing
 * the game's name "Deer Pelt" as a count of a chest retains it (normalized),
 * and a contact who sells Biche. Returns its address and the contact's name.
 */
async function shopWithGameName() {
  const name = uniqueName("Alias");
  const slug = name.toLowerCase();
  const contact = uniqueName("Chasseur");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [shop] = await sql`insert into shops (name, slug) values (${name}, ${slug}) returning id`;
    await sql`
      insert into shop_members (shop_id, member_id, role)
      select ${shop.id}, id, 'gerant' from members where username = ${GERANT.username}`;
    const [category] = await sql`
      insert into product_categories (shop_id, name) values (${shop.id}, 'Gibier') returning id`;
    const [biche] = await sql`
      insert into products (shop_id, name, category_id, unit, stock, buy_price, sell_price)
      values (${shop.id}, 'Biche', ${category.id}, 'peau', 10, 2, 4) returning id`;
    await sql`
      insert into products (shop_id, name, category_id, unit, stock, buy_price, sell_price)
      values (${shop.id}, 'Loup', ${category.id}, 'peau', 10, 3, 6)`;
    await sql`insert into product_aliases (shop_id, name, product_id) values (${shop.id}, 'deer pelt', ${biche.id})`;
    const [supplier] = await sql`insert into suppliers (shop_id, name) values (${shop.id}, ${contact}) returning id`;
    await sql`insert into supplier_offers (supplier_id, product_id, price) values (${supplier.id}, ${biche.id}, 2)`;
  } finally {
    await sql.end();
  }
  return { shop: `/${slug}`, contact };
}

/** Types into a merchandise picker and expects only Biche in its list. */
async function typeAndFindBiche(form: Locator, text: string) {
  await form.getByRole("combobox", { name: "Marchandise", exact: true }).fill(text);
  const list = form.getByRole("listbox", { name: "Marchandises" });
  await expect(list.getByRole("option", { name: "Biche", exact: true })).toBeVisible();
  await expect(list.getByRole("option", { name: "Loup", exact: true })).toHaveCount(0);
}

test("une marchandise se trouve partout par le nom du jeu que la boutique a retenu", async ({ page }) => {
  const { shop, contact } = await shopWithGameName();
  await loginAsGerant(page);

  // Tarifs: the search and the calculator.
  await page.goto(`${shop}/tarifs`);
  await expect(page.getByRole("row", { name: /^Loup/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Chercher une marchandise" }).fill("Deer");
  await expect(page.getByRole("row", { name: /^Loup/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /^Biche/ })).toBeVisible();
  await typeAndFindBiche(page.getByTestId("calculateur"), "deer");

  // Gérer les marchandises.
  await page.goto(`${shop}/marchandises`);
  await page.getByRole("searchbox", { name: "Chercher une marchandise" }).fill("deer pelts");
  await expect(page.getByRole("link", { name: "Modifier Loup" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Modifier Biche" })).toBeVisible();

  // A stock movement picks Biche by its game name.
  await page.goto(`${shop}/inventaire/mouvement`);
  const form = page.getByRole("region", { name: "Inscrire un mouvement de stock" });
  await form.getByRole("radio", { name: "Entrée en stock" }).check();
  const line = form.getByRole("group", { name: "Marchandise 1" });
  await typeAndFindBiche(line, "Deer");
  await line.getByRole("option", { name: "Biche", exact: true }).click();
  await line.getByLabel("Quantité").fill("2");
  await form.getByLabel("Motif").fill("Chasse");
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page.getByRole("status")).toHaveText("Mouvement de stock inscrit : +2 Biche.");

  // Inventaire: the stock cards, and the history.
  await page.getByLabel("Rechercher une marchandise").fill("DEER");
  await expect(page.getByTestId("stock-Loup")).toHaveCount(0);
  await expect(page.getByTestId("stock-Biche").getByTestId("stock-value")).toHaveText("12");
  const history = page.getByRole("region", { name: "Historique des mouvements" });
  await history.getByRole("searchbox", { name: "Chercher une marchandise" }).fill("pelt");
  await expect(page).toHaveURL(/q=pelt/);
  const rows = page.getByTestId("historique").locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Biche");

  // A sale.
  await page.goto(`${shop}/achat-vente/vente`);
  await typeAndFindBiche(page.getByRole("region", { name: "Inscrire une vente" }), "deer");

  // Contacts, by the merchandise they sell.
  await page.goto(`${shop}/contacts`);
  await page.getByRole("searchbox", { name: "Chercher un nom, un lieu ou une marchandise" }).fill("Deer Pelt");
  await expect(page.getByRole("article", { name: contact, exact: true })).toBeVisible();
});
