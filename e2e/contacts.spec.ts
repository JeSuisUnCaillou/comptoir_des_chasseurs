import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { createProduct, loginAsGerant, newEmployeePage, pickProduct, uniqueName } from "./helpers";

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

test("le gérant crée un contact, lui donne des marchandises, le modifie puis le supprime", async ({ page }) => {
  const name = uniqueName("Markir");
  const hide = uniqueName("Peau de smilodon");
  // Sorted by name: the gigot comes before the peau.
  const meat = uniqueName("Gigot");
  await createProduct(hide);
  await createProduct(meat, { unit: "pièce", category: "viande" });
  await loginAsGerant(page);

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Contacts" }).click();
  await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Ajouter un contact" }).click();
  await expect(page.getByRole("heading", { name: "Nouveau contact" })).toBeVisible();
  await page.getByLabel("Lieu").fill("Blancherive");
  await page.getByLabel("Note").fill("Représentant des Guerriers-Nés");
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByText("Aucune marchandise pour l'instant.")).toBeVisible();

  await pickProduct(page.getByRole("form", { name: "Ajouter une marchandise" }), `${hide} (peau)`);
  await page.getByLabel("Prix en septims").fill("3");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Marchandise enregistrée." })).toBeVisible();
  await expect(page.getByRole("cell", { name: "3 septims pour 1 peau" })).toBeVisible();

  await pickProduct(page.getByRole("form", { name: "Ajouter une marchandise" }), `${meat} (pièce)`);
  await page.getByLabel("Prix en septims").fill("1");
  await page.getByLabel("Pour (unités)").fill("6");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("cell", { name: "1 septim pour 6 pièces" })).toBeVisible();

  // The same merchandise again changes its price.
  await pickProduct(page.getByRole("form", { name: "Ajouter une marchandise" }), `${hide} (peau)`);
  await page.getByLabel("Prix en septims").fill("2");
  await page.getByLabel("Pour (unités)").fill("1");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("cell", { name: "2 septims pour 1 peau" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "3 septims pour 1 peau" })).toHaveCount(0);

  // The card shows everything, everyone's way.
  await page.getByRole("link", { name: "← Contacts" }).click();
  await search(page, name);
  const supplier = card(page, name);
  await expect(supplier).toContainText("Blancherive");
  await expect(supplier).toContainText("Représentant des Guerriers-Nés");
  await expect(supplier.getByText("Fournisseur", { exact: true })).toBeVisible();
  await expect(supplier.getByRole("list", { name: "Il nous vend" }).getByRole("listitem")).toHaveText([
    new RegExp(`${meat}1 septimpour 6 pièces`),
    new RegExp(`${hide}2 septimspour 1 peau`),
  ]);

  // Rename it, and take a merchandise back.
  await supplier.getByRole("link", { name: `Modifier ${name}` }).click();
  const renamed = `${name} le Jeune`;
  await page.getByLabel("Nom", { exact: true }).fill(renamed);
  await page.getByRole("button", { name: "Enregistrer le contact" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Contact enregistré." })).toBeVisible();
  await page.getByRole("button", { name: `Retirer ${meat}` }).click();
  await expect(page.getByRole("cell", { name: meat })).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer le contact" }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await search(page, renamed);
  await expect(page.getByText("Aucun contact ne correspond.")).toBeVisible();
});

test("deux contacts ne portent pas le même nom", async ({ page }) => {
  const name = uniqueName("Do'Dran");
  await createSuppliers([name]);
  await loginAsGerant(page);
  await page.goto("/contacts/nouveau");
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Ajouter le contact" }).click();
  await expect(page.getByText("Il y a déjà un contact à ce nom.")).toBeVisible();
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(name);
});

test("la recherche trouve un contact par son nom, son lieu ou ce qu'il vend", async ({ page }) => {
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
  await page.goto("/contacts");

  for (const q of [name.toUpperCase(), place, product]) {
    await search(page, q);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(card(page, name)).toContainText(product);
  }
  await page.getByRole("link", { name: "Tout afficher" }).click();
  await expect(page.getByLabel("Rechercher un nom, un lieu ou une marchandise")).toHaveValue("");
});

test("les contacts sont paginés et rangés par nom", async ({ page }) => {
  const prefix = uniqueName("Pagine");
  // 13 suppliers: one more than a page. Inserted out of order.
  const names = Array.from({ length: 13 }, (_, i) => `${prefix} ${String.fromCharCode(97 + i)}`).reverse();
  await createSuppliers(names);
  await loginAsGerant(page);
  await page.goto("/contacts");
  await search(page, prefix);

  const pages = page.getByRole("navigation", { name: "Pages des contacts" });
  await expect(pages).toContainText("Page 1 sur 2 · 13 contacts");
  await expect(page.getByRole("article")).toHaveCount(12);
  await expect(page.getByRole("article").first().getByRole("heading", { level: 3 })).toHaveText(`${prefix} a`);
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(pages).toContainText("Page 2 sur 2");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article").getByRole("heading", { level: 3 })).toHaveText(`${prefix} m`);
});

test("un employé consulte les contacts sans pouvoir les modifier", async ({ browser }) => {
  const name = uniqueName("Markir");
  await createSuppliers([name], "Blancherive");
  const { page } = await newEmployeePage(browser, "employe-fournisseurs");

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Contacts" }).click();
  await search(page, name);
  await expect(card(page, name)).toContainText("Blancherive");
  await expect(page.getByRole("link", { name: "Ajouter un contact" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `Modifier ${name}` })).toHaveCount(0);

  // The gérant's pages send them back home.
  await page.goto("/contacts/nouveau");
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
});

test("un client : ce qu'il nous achète, à part de ce qu'il nous vend, et l'étiquette qui suit", async ({ page }) => {
  const name = uniqueName("Roy");
  const claw = uniqueName("Griffe de troll");
  const hide = uniqueName("Peau de horker");
  await createProduct(claw, { unit: "pièce", category: "viande" });
  await createProduct(hide);
  await createSuppliers([name], "Vendeaume");
  await loginAsGerant(page);
  await page.goto("/contacts");
  await search(page, name);
  const contact = card(page, name);
  // Nothing listed yet: neither supplier nor customer.
  await expect(contact.getByText("Contact", { exact: true })).toBeVisible();

  await contact.getByRole("link", { name: `Modifier ${name}` }).click();
  await pickProduct(page.getByRole("form", { name: "Ajouter une marchandise" }), `${claw} (pièce)`);
  await page.getByLabel("Sens").selectOption({ label: "Il nous l'achète" });
  await page.getByLabel("Prix en septims").fill("1");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("table", { name: "Il nous achète" }).getByRole("row", { name: new RegExp(`^${claw} 1 septim pour 1 pièce`) })).toBeVisible();

  await page.getByRole("link", { name: "← Contacts" }).click();
  await search(page, name);
  await expect(contact.getByText("Client", { exact: true })).toBeVisible();
  await expect(contact.getByRole("list", { name: "Il nous achète" }).getByRole("listitem")).toHaveText([
    new RegExp(`${claw}1 septimpour 1 pièce`),
  ]);
  await expect(contact.getByRole("list", { name: "Il nous vend" })).toHaveCount(0);

  // He also sells us something: both.
  await contact.getByRole("link", { name: `Modifier ${name}` }).click();
  await pickProduct(page.getByRole("form", { name: "Ajouter une marchandise" }), `${hide} (peau)`);
  await page.getByLabel("Prix en septims").fill("3");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("table", { name: "Il nous vend" }).getByRole("row", { name: new RegExp(`^${hide} 3 septims pour 1 peau`) })).toBeVisible();
  await page.getByRole("link", { name: "← Contacts" }).click();
  await search(page, name);
  await expect(contact.getByText("Fournisseur et client", { exact: true })).toBeVisible();
  await expect(contact.getByRole("list", { name: "Il nous vend" })).toContainText(hide);
  await expect(contact.getByRole("list", { name: "Il nous achète" })).toContainText(claw);

  // Saving the claw the other way moves it: one side per merchandise.
  await contact.getByRole("link", { name: `Modifier ${name}` }).click();
  await pickProduct(page.getByRole("form", { name: "Ajouter une marchandise" }), `${claw} (pièce)`);
  await page.getByLabel("Sens").selectOption({ label: "Il nous la vend" });
  await page.getByLabel("Prix en septims").fill("2");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("table", { name: "Il nous vend" }).getByRole("row", { name: new RegExp(`^${claw} 2 septims pour 1 pièce`) })).toBeVisible();
  await expect(page.getByRole("table", { name: "Il nous achète" })).toHaveCount(0);
  await page.getByRole("link", { name: "← Contacts" }).click();
  await search(page, name);
  await expect(contact.getByText("Fournisseur", { exact: true })).toBeVisible();
});
