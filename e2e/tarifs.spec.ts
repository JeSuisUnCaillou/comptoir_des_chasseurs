import { expect, test } from "@playwright/test";
import { loginAsGerant } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Tarifs" }).click();
});

test("la grille des peaux affiche transformation et bénéfice par lot", async ({ page }) => {
  const peaux = page.getByRole("region", { name: /Tarifs des peaux/ });
  const biche = peaux.getByRole("row", { name: /Biche/ });
  await expect(biche).toContainText("4 peaux → 2 cuirs");
  await expect(biche).toContainText("+4 septims");
  const ours = peaux.getByRole("row", { name: /^Ours 4 peaux/ });
  await expect(ours).toContainText("+12 septims");
  await expect(peaux).toContainText("rachat du cuir par le forgeron : 6 septims");
});

test("les ressources affichent un bénéfice sur des lots entiers", async ({ page }) => {
  const chasse = page.getByRole("region", { name: /Viandes, venaison et ressources/ });
  await expect(chasse.getByRole("row", { name: /Flèches d'acier/ })).toContainText(
    "+85 septims pour 880 unités",
  );
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toContainText(
    "Dès 200 : 2 septims / unité",
  );
});

test("le calculateur donne rachat, vente et transformation", async ({ page }) => {
  const calc = page.getByTestId("calculateur");
  await calc.getByLabel("Marchandise").selectOption({ label: "Biche" });
  await calc.getByLabel("Quantité").fill("4");
  await expect(calc.getByTestId("calc-rachat")).toHaveText("8 septims");
  await expect(calc.getByTestId("calc-vente")).toHaveText("12 septims");
  await expect(calc.getByTestId("calc-transfo")).toContainText("1 lot → 2 cuirs");

  await calc.getByLabel("Marchandise").selectOption({ label: "Venaison" });
  await calc.getByLabel("Quantité").fill("200");
  await expect(calc.getByTestId("calc-vente")).toHaveText("400 septims");
  await expect(calc).toContainText("Tarif de gros");
  await expect(calc.getByTestId("calc-benefice")).toHaveText("+200 septims");
});
