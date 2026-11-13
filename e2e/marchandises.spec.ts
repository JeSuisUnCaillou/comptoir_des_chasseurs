import { expect, test } from "@playwright/test";
import { ALERT, createProduct, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

test("un gérant crée puis modifie une marchandise, visible dans les tarifs", async ({ page }) => {
  const name = uniqueName("Peau de chèvre des glaces");
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Tarifs" }).click();
  await page.getByRole("link", { name: "Gérer les marchandises" }).click();
  await expect(page.getByRole("heading", { name: "Gérer les marchandises", level: 1 })).toBeVisible();
  // The page belongs to Tarifs in the menu.
  await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Tarifs" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill(name);
  await form.getByLabel("Catégorie").selectOption("peau");
  await form.getByLabel("Unité (au singulier)").fill("peau");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).first().fill("3");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).nth(1).fill("5");
  await form.getByLabel("Peaux par lot").fill("2");
  await form.getByLabel("Cuirs obtenus").fill("2");
  await form.getByRole("button", { name: "Ajouter la marchandise" }).click();

  // The catalogue is paginated: find the new product with the search.
  await expect(async () => {
    await page.goto("/marchandises");
    await page.getByRole("searchbox", { name: "Chercher une marchandise" }).fill(name);
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("link", { name: /^Modifier / })).toHaveCount(1, { timeout: 1000 });
  }).toPass();
  await page.getByRole("link", { name: `Modifier ${name}` }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Prix en septims" }).first().fill("2");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page).toHaveURL(/\/marchandises$/);

  await page.getByRole("link", { name: "Tarifs" }).click();
  const row = page.getByRole("region", { name: "Peaux", exact: true }).getByRole("row", { name: new RegExp(name) });
  // 2 cuirs × 6 (forgeron) − 2 peaux × 2 = +8
  await expect(row).toContainText("2 peaux → 2 cuirs");
  await expect(row).toContainText("+8 septims");
});

test("deux marchandises ne peuvent pas porter le même nom", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/marchandises");
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill("Biche");
  await form.getByRole("button", { name: "Ajouter la marchandise" }).click();
  await expect(form.locator(ALERT)).toHaveText("Il y a déjà une marchandise à ce nom.");
});

test("une saisie refusée garde ce qui a été tapé", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/marchandises");
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill("Peau à moitié remplie");
  await form.getByLabel("Catégorie").selectOption("peau");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).first().fill("4");
  await form.getByLabel("Peaux par lot").fill("2");
  await form.getByRole("button", { name: "Ajouter la marchandise" }).click();
  await expect(form.locator(ALERT)).toContainText("Remplis les peaux et les cuirs");
  await expect(form.getByLabel("Nom")).toHaveValue("Peau à moitié remplie");
  await expect(form.getByRole("spinbutton", { name: "Prix en septims" }).first()).toHaveValue("4");
});

test("un employé ne voit pas la gestion des marchandises", async ({ browser }) => {
  const { page: employee } = await newEmployeePage(browser, "sariel");
  await expect(employee.getByRole("link", { name: "Tarifs" })).toBeVisible();
  await employee.getByRole("link", { name: "Tarifs" }).click();
  await expect(employee.getByRole("heading", { name: "Tarifs", level: 1 })).toBeVisible();
  await expect(employee.getByRole("link", { name: "Gérer les marchandises" })).toHaveCount(0);
  await expect(employee.getByRole("region", { name: "Cuir", exact: true })).toBeVisible();
  await expect(employee.getByRole("link", { name: "Gérer les produits phares" })).toHaveCount(0);
  await employee.goto("/marchandises");
  await expect(employee).toHaveURL(/\/le-comptoir-des-chasseurs$/);
});

test("le catalogue vient après l'ajout et le réglage du cuir", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/marchandises");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Ajouter une marchandise",
    "Produits phares",
    "Rachat du cuir par le forgeron",
    "Toutes les marchandises",
  ]);
  // The catalogue panel keeps the usual gap below the two panels above it.
  const panel = (name: string) => page.locator("section.panel").filter({ has: page.getByRole("heading", { name, level: 2 }) });
  const above = await panel("Ajouter une marchandise").boundingBox();
  const catalogue = await panel("Toutes les marchandises").boundingBox();
  expect(catalogue!.y - (above!.y + above!.height)).toBeGreaterThanOrEqual(20);
});

test("une marchandise archivée quitte les tarifs et les ventes, puis y revient", async ({ page }) => {
  const name = uniqueName("Bois de cerf");
  await createProduct(name, { category: "ressource", unit: "bois", buyPrice: 2, sellPrice: 4 });
  await loginAsGerant(page);

  const search = async () => {
    await page.goto("/marchandises");
    await page.getByRole("searchbox", { name: "Chercher une marchandise" }).fill(name);
    await expect(page).toHaveURL(/q=/);
    return page.getByRole("row", { name: new RegExp(name) });
  };
  const setArchived = async (archived: boolean) => {
    await (await search()).getByRole("link", { name: `Modifier ${name}` }).click();
    await page.getByLabel(/Ne plus utiliser/).setChecked(archived);
    await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
    await expect(page).toHaveURL(/\/marchandises$/);
  };
  const offeredForSale = async () => {
    await page.goto("/achat-vente/vente");
    const box = page.getByRole("combobox", { name: "Marchandise" });
    await box.fill(name);
    return page.getByRole("option", { name, exact: true });
  };

  await setArchived(true);
  await expect((await search()).getByText("Archivée", { exact: true })).toBeVisible();
  await page.goto("/tarifs");
  await expect(page.getByText(name)).toHaveCount(0);
  await expect(await offeredForSale()).toHaveCount(0);

  await setArchived(false);
  await expect((await search()).getByText("Archivée", { exact: true })).toHaveCount(0);
  await page.goto("/tarifs");
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  await expect(await offeredForSale()).toBeVisible();
});
