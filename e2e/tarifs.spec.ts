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
  await calc.getByLabel("Marchandise", { exact: true }).selectOption({ label: "Biche" });
  await calc.getByLabel("Quantité").fill("4");
  await expect(calc.getByTestId("calc-rachat")).toHaveText("8 septims");
  await expect(calc.getByTestId("calc-vente")).toHaveText("12 septims");
  await expect(calc.getByTestId("calc-transfo")).toContainText("1 lot → 2 cuirs");

  await calc.getByLabel("Marchandise", { exact: true }).selectOption({ label: "Venaison" });
  await calc.getByLabel("Quantité").fill("200");
  await expect(calc.getByTestId("calc-vente")).toHaveText("400 septims");
  await expect(calc).toContainText("Tarif de gros");
  await expect(calc.getByTestId("calc-benefice")).toHaveText("+200 septims");
});

test("la recherche filtre les tarifs pendant qu'on tape", async ({ page }) => {
  const peaux = page.getByRole("region", { name: /Tarifs des peaux/ });
  const chasse = page.getByRole("region", { name: /Viandes, venaison et ressources/ });
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toBeVisible();

  const search = page.getByRole("search").getByRole("searchbox", { name: "Chercher une marchandise" });
  await expect(page.getByRole("button", { name: "Chercher" })).toHaveCount(0);
  // The bar takes at least half of the page's width.
  const bar = (await search.boundingBox())!;
  const panel = (await peaux.boundingBox())!;
  expect(bar.width).toBeGreaterThanOrEqual(panel.width / 2);
  // Leather and the calculator come first, then the bar, then the tables.
  const cuir = (await page.getByRole("region", { name: "Tarifs du cuir" }).boundingBox())!;
  const calcul = (await page.getByRole("region", { name: "Calculateur des prix" }).boundingBox())!;
  expect(cuir.y).toBeLessThan(bar.y);
  expect(calcul.y).toBeLessThan(bar.y);
  expect(bar.y).toBeLessThan(panel.y);
  await search.pressSequentially("ours");
  await expect(page).toHaveURL(/\/tarifs\?q=ours$/);
  await expect(peaux.getByRole("row", { name: /^Ours 4 peaux/ })).toBeVisible();
  await expect(peaux.getByRole("row", { name: /Biche/ })).toHaveCount(0);
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toHaveCount(0);
  await expect(chasse.getByText("Aucune marchandise ne correspond.")).toHaveCount(2);
  // The calculator still offers every product.
  await expect(page.getByTestId("calculateur").getByLabel("Marchandise", { exact: true }).getByRole("option", { name: "Biche" })).toHaveCount(1);

  await search.fill("venaison");
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toBeVisible();
  await expect(peaux.getByText("Aucune marchandise ne correspond.")).toBeVisible();

  await search.clear();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();

  // Leaving the search by the menu or the back button shows the URL's query in the field.
  await search.pressSequentially("biche");
  await expect(page).toHaveURL(/\/tarifs\?q=biche$/);
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Tarifs" }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toBeVisible();
  await expect(search).toHaveValue("");
  await page.goBack();
  await expect(page).toHaveURL(/\/tarifs\?q=biche$/);
  await expect(search).toHaveValue("biche");
});

test("le calculateur a sa propre recherche, qui filtre ses marchandises", async ({ page }) => {
  const calc = page.getByTestId("calculateur");
  const choice = calc.getByLabel("Marchandise", { exact: true });
  await calc.getByRole("searchbox", { name: "Chercher une marchandise" }).fill("venai");
  await expect(choice.getByRole("option")).toHaveText(["Venaison"]);
  await expect(choice).toHaveValue(await choice.getByRole("option", { name: "Venaison" }).getAttribute("value") ?? "");
  await calc.getByLabel("Quantité").fill("200");
  await expect(calc.getByTestId("calc-vente")).toHaveText("400 septims");
  // The tables above are not filtered by it.
  await expect(page.getByRole("region", { name: /Tarifs des peaux/ }).getByRole("row", { name: /Biche/ })).toBeVisible();

  await calc.getByRole("searchbox", { name: "Chercher une marchandise" }).fill("introuvable-xyz");
  await expect(calc).toContainText("Aucune marchandise ne correspond.");
  await calc.getByRole("searchbox", { name: "Chercher une marchandise" }).clear();
  await expect(choice.getByRole("option", { name: "Biche" })).toHaveCount(1);
});
