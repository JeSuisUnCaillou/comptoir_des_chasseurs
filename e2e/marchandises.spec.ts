import { expect, test } from "@playwright/test";
import { loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

test("un gérant crée puis modifie une marchandise, visible dans les tarifs", async ({ page }) => {
  const name = uniqueName("Peau de chèvre des glaces");
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Marchandises" }).click();

  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill(name);
  await form.getByLabel("Catégorie").selectOption("peau");
  await form.getByLabel("Unité (au singulier)").fill("peau");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).first().fill("3");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).nth(1).fill("5");
  await form.getByLabel("Peaux par lot").fill("2");
  await form.getByLabel("Cuirs obtenus").fill("2");
  await form.getByRole("button", { name: "Ajouter la marchandise" }).click();

  await page.getByRole("link", { name: `Modifier ${name}` }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Prix en septims" }).first().fill("2");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page).toHaveURL(/\/marchandises$/);

  await page.getByRole("link", { name: "Tarifs" }).click();
  const row = page.getByRole("region", { name: /Tarifs des peaux/ }).getByRole("row", { name: new RegExp(name) });
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
  await expect(form.locator(ALERT)).toHaveText("Une marchandise porte déjà ce nom.");
});

test("un employé ne voit pas la gestion des marchandises", async ({ browser }) => {
  const { page: employee } = await newEmployeePage(browser, "sariel");
  await expect(employee.getByRole("link", { name: "Tarifs" })).toBeVisible();
  await expect(employee.getByRole("link", { name: "Marchandises" })).toHaveCount(0);
  await employee.getByRole("link", { name: "Tarifs" }).click();
  await expect(employee.getByRole("heading", { name: "Tarifs", level: 1 })).toBeVisible();
  await expect(employee.getByRole("link", { name: "Gérer les marchandises" })).toHaveCount(0);
  await employee.goto("/marchandises");
  await expect(employee).toHaveURL(/\/$/);
});
