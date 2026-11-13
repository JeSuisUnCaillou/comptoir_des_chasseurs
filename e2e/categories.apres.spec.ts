import { expect, test } from "@playwright/test";
import { createProduct, loginAsGerant, uniqueName } from "./helpers";

// Renames a category of the whole comptoir, which other tests look for by name.
test.describe.configure({ mode: "serial" });

test("renommer la catégorie des peaux garde leur grille de transformation", async ({ page }) => {
  const hide = uniqueName("Peau de troll");
  await createProduct(hide, { category: "Peaux" });
  await loginAsGerant(page);
  await page.goto("/marchandises");
  const peaux = page.getByRole("region", { name: "Catégories" }).getByTestId("categorie-Peaux");
  const renamed = "Peaux tannables";
  try {
    await peaux.getByLabel("Nom de la catégorie Peaux").fill(renamed);
    await peaux.getByRole("button", { name: "Renommer" }).click();
    await expect(page.getByRole("region", { name: "Catégories" }).getByTestId(`categorie-${renamed}`)).toBeVisible();

    await page.goto(`/tarifs?q=${encodeURIComponent(hide)}`);
    const grid = page.getByRole("region", { name: renamed });
    await expect(grid.getByRole("columnheader", { name: "Transformation" })).toBeVisible();
    await expect(grid).toContainText(hide);
    await page.goto(`/marchandises?q=${encodeURIComponent(hide)}`);
    await page.getByRole("link", { name: `Modifier ${hide}` }).click();
    await expect(page.getByLabel("Peaux par lot")).toBeVisible();
  } finally {
    await page.goto("/marchandises");
    const row = page.getByRole("region", { name: "Catégories" }).getByTestId(`categorie-${renamed}`);
    await row.getByLabel(`Nom de la catégorie ${renamed}`).fill("Peaux");
    await row.getByRole("button", { name: "Renommer" }).click();
    await expect(page.getByRole("region", { name: "Catégories" }).getByTestId("categorie-Peaux")).toBeVisible();
  }
});
