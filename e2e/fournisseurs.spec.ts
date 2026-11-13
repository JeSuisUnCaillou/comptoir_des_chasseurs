import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { createProduct, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

/** Creates suppliers straight in the database, with no offers. */
async function createSuppliers(names: string[], place = "") {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    for (const name of names) await sql`insert into suppliers (shop_id, name, place) values (1, ${name}, ${place})`;
  } finally {
    await sql.end();
  }
}

async function search(page: Page, q: string) {
  await page.getByLabel("Rechercher un nom, un lieu ou une marchandise").fill(q);
  await page.getByRole("button", { name: "Chercher" }).click();
}

function card(page: Page, name: string) {
  return page.getByRole("article", { name, exact: true });
}

test("le gérant crée un fournisseur, lui donne des marchandises, le modifie puis le supprime", async ({ page }) => {
  const name = uniqueName("Markir");
  const hide = uniqueName("Peau de smilodon");
  // Sorted by name: the gigot comes before the peau.
  const meat = uniqueName("Gigot");
  await createProduct(hide);
  await createProduct(meat, { unit: "pièce", category: "viande" });
  await loginAsGerant(page);

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Fournisseurs" }).click();
  await expect(page.getByRole("heading", { name: "Fournisseurs", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Ajouter un fournisseur" }).click();
  await expect(page.getByRole("heading", { name: "Nouveau fournisseur" })).toBeVisible();
  await page.getByLabel("Lieu").fill("Blancherive");
  await page.getByLabel("Note").fill("Représentant des Guerriers-Nés");
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Ajouter le fournisseur" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByText("Aucune marchandise pour l'instant.")).toBeVisible();

  await page.getByLabel("Marchandise", { exact: true }).selectOption({ label: `${hide} (peau)` });
  await page.getByLabel("Prix en septims").fill("3");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Marchandise enregistrée." })).toBeVisible();
  await expect(page.getByRole("cell", { name: "3 septims pour 1 peau" })).toBeVisible();

  await page.getByLabel("Marchandise", { exact: true }).selectOption({ label: `${meat} (pièce)` });
  await page.getByLabel("Prix en septims").fill("1");
  await page.getByLabel("Pour (unités)").fill("6");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("cell", { name: "1 septim pour 6 pièces" })).toBeVisible();

  // The same merchandise again changes its price.
  await page.getByLabel("Marchandise", { exact: true }).selectOption({ label: `${hide} (peau)` });
  await page.getByLabel("Prix en septims").fill("2");
  await page.getByLabel("Pour (unités)").fill("1");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("cell", { name: "2 septims pour 1 peau" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "3 septims pour 1 peau" })).toHaveCount(0);

  // The card shows everything, everyone's way.
  await page.getByRole("link", { name: "← Fournisseurs" }).click();
  await search(page, name);
  const supplier = card(page, name);
  await expect(supplier).toContainText("Blancherive");
  await expect(supplier).toContainText("Représentant des Guerriers-Nés");
  await expect(supplier.getByRole("listitem")).toHaveText([
    new RegExp(`${meat}1 septimpour 6 pièces`),
    new RegExp(`${hide}2 septimspour 1 peau`),
  ]);

  // Rename it, and take a merchandise back.
  await supplier.getByRole("link", { name: `Modifier ${name}` }).click();
  const renamed = `${name} le Jeune`;
  await page.getByLabel("Nom", { exact: true }).fill(renamed);
  await page.getByRole("button", { name: "Enregistrer le fournisseur" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Fournisseur enregistré." })).toBeVisible();
  await page.getByRole("button", { name: `Retirer ${meat}` }).click();
  await expect(page.getByRole("cell", { name: meat })).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer le fournisseur" }).click();
  await expect(page).toHaveURL(/\/fournisseurs$/);
  await search(page, renamed);
  await expect(page.getByText("Aucun fournisseur ne correspond.")).toBeVisible();
});

test("deux fournisseurs ne portent pas le même nom", async ({ page }) => {
  const name = uniqueName("Do'Dran");
  await createSuppliers([name]);
  await loginAsGerant(page);
  await page.goto("/fournisseurs/nouveau");
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Ajouter le fournisseur" }).click();
  await expect(page.getByText("Il y a déjà un fournisseur à ce nom.")).toBeVisible();
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(name);
});

test("la recherche trouve un fournisseur par son nom, son lieu ou ce qu'il vend", async ({ page }) => {
  const name = uniqueName("Swennec");
  const place = uniqueName("Pierre de Shor");
  const product = uniqueName("Cuir");
  await createProduct(product, { unit: "cuir", category: "cuir" });
  await createSuppliers([name], place);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into supplier_offers (supplier_id, product_id, price)
      select s.id, p.id, 3 from suppliers s, products p where s.name = ${name} and p.name = ${product}`;
  } finally {
    await sql.end();
  }
  await loginAsGerant(page);
  await page.goto("/fournisseurs");

  for (const q of [name.toUpperCase(), place, product]) {
    await search(page, q);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(card(page, name)).toContainText(product);
  }
  await page.getByRole("link", { name: "Tout afficher" }).click();
  await expect(page.getByLabel("Rechercher un nom, un lieu ou une marchandise")).toHaveValue("");
});

test("les fournisseurs sont paginés et rangés par nom", async ({ page }) => {
  const prefix = uniqueName("Pagine");
  // 13 suppliers: one more than a page. Inserted out of order.
  const names = Array.from({ length: 13 }, (_, i) => `${prefix} ${String.fromCharCode(97 + i)}`).reverse();
  await createSuppliers(names);
  await loginAsGerant(page);
  await page.goto("/fournisseurs");
  await search(page, prefix);

  const pages = page.getByRole("navigation", { name: "Pages des fournisseurs" });
  await expect(pages).toContainText("Page 1 sur 2 · 13 fournisseurs");
  await expect(page.getByRole("article")).toHaveCount(12);
  await expect(page.getByRole("article").first().getByRole("heading", { level: 3 })).toHaveText(`${prefix} a`);
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(pages).toContainText("Page 2 sur 2");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").getByRole("heading", { level: 3 })).toHaveText(`${prefix} m`);
});

test("un employé consulte les fournisseurs sans pouvoir les modifier", async ({ browser }) => {
  const name = uniqueName("Markir");
  await createSuppliers([name], "Blancherive");
  const { page } = await newEmployeePage(browser, "employe-fournisseurs");

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Fournisseurs" }).click();
  await search(page, name);
  await expect(card(page, name)).toContainText("Blancherive");
  await expect(page.getByRole("link", { name: "Ajouter un fournisseur" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `Modifier ${name}` })).toHaveCount(0);

  // The gérant's pages send them back home.
  await page.goto("/fournisseurs/nouveau");
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
});
