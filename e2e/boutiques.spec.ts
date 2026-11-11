import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";
import { loginAsGerant, uniqueName } from "./helpers";

/**
 * Another shop, made straight in the database, with a member, a merchandise
 * named `product` put in stock, a supplier, a parchment and a sale of its own.
 */
async function createOtherShop(product: string) {
  const slug = uniqueName("taverne-du-port").toLowerCase();
  const names = {
    shop: `Taverne ${slug}`,
    member: uniqueName("Tavernier"),
    supplier: uniqueName("Brasseur"),
    announcement: uniqueName("Hydromel à volonté"),
    counterparty: uniqueName("Client de la taverne"),
  };
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [shop] = await sql`insert into shops (name, slug) values (${names.shop}, ${slug}) returning id`;
    const [member] = await sql`
      insert into members (username, name, password_hash)
      values (${names.member.toLowerCase()}, ${names.member}, ${await hashPassword("mot-de-passe")})
      returning id`;
    await sql`insert into shop_members (shop_id, member_id, role) values (${shop.id}, ${member.id}, 'gerant')`;
    const [item] = await sql`
      insert into products (shop_id, name, category, unit, stock, buy_price, sell_price)
      values (${shop.id}, ${product}, 'viande', 'pièce', 9, 1, 2)
      returning id`;
    await sql`
      insert into stock_movements (shop_id, product_id, delta, stock_after, member_id, reason)
      values (${shop.id}, ${item.id}, 9, 9, ${member.id}, 'brassage')`;
    const [supplier] = await sql`
      insert into suppliers (shop_id, name) values (${shop.id}, ${names.supplier}) returning id`;
    await sql`
      insert into announcements (shop_id, title, body, member_id)
      values (${shop.id}, ${names.announcement}, 'Pour tous les clients.', ${member.id})`;
    await sql`
      insert into transactions (shop_id, kind, product_id, label, quantity, amount, counterparty, member_id)
      values (${shop.id}, 'vente', ${item.id}, ${product}, 1, 2, ${names.counterparty}, ${member.id})`;
    return { ...names, memberId: member.id, productId: item.id, supplierId: supplier.id };
  } finally {
    await sql.end();
  }
}

test("le comptoir ne montre rien d'une autre boutique", async ({ page }) => {
  const product = uniqueName("Hydromel");
  const other = await createOtherShop(product);
  await loginAsGerant(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
  await expect(page.getByText(other.announcement)).toHaveCount(0);

  await page.goto(`/tarifs?chasse=${encodeURIComponent(product)}`);
  await expect(page.getByRole("heading", { name: "Tarifs", level: 1 })).toBeVisible();
  await expect(page.getByText(product)).toHaveCount(0);

  await page.goto(`/inventaire?q=${encodeURIComponent(product)}`);
  await expect(page.getByTestId(`stock-${product}`)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Inventaire", level: 1 })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(product);
  await expect(page.getByLabel("Employé")).not.toContainText(other.member);

  await page.goto("/achat-vente");
  await expect(page.getByText(other.counterparty)).toHaveCount(0);
  await expect(page.getByLabel("Employé")).not.toContainText(other.member);

  await page.goto("/annonces");
  await expect(page.getByText(other.announcement)).toHaveCount(0);

  await page.goto("/fournisseurs");
  await expect(page.getByRole("heading", { name: "Fournisseurs", level: 1 })).toBeVisible();
  await expect(page.getByText(other.supplier)).toHaveCount(0);

  await page.goto("/membres");
  await expect(page.getByRole("heading", { name: "Membres", level: 1 })).toBeVisible();
  await expect(page.getByText(other.member)).toHaveCount(0);

  // Its pages can't be opened by their address either.
  for (const path of [`/membres/${other.memberId}`, `/marchandises/${other.productId}`, `/fournisseurs/${other.supplierId}`]) {
    await page.goto(path);
    await expect(page.getByText("This page could not be found."), path).toBeVisible();
  }
});

test("deux boutiques peuvent avoir une marchandise du même nom", async ({ page }) => {
  const product = uniqueName("Hydromel");
  await createOtherShop(product);
  await loginAsGerant(page);

  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(product);
  await expect(page.getByText("Aucune marchandise ne correspond.")).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle marchandise" }).click();
  const form = page.getByRole("form", { name: "Nouvelle marchandise" });
  await form.getByLabel("Catégorie").selectOption("viande");
  await form.getByLabel("Quantité entrée").fill("2");
  await form.getByLabel("Motif").fill("brassé au comptoir");
  await form.getByRole("button", { name: "Créer et entrer en stock" }).click();
  await expect(page.getByTestId(`stock-${product}`).getByTestId("stock-value")).toHaveText("2");
});
