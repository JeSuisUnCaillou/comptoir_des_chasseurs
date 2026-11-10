import { expect, test, type Locator } from "@playwright/test";
import { createProduct, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

/** Picks a product in the calculator by typing its name and clicking it in the list. */
async function pick(calc: Locator, name: string) {
  await calc.getByRole("combobox", { name: "Marchandise" }).fill(name);
  await calc.getByRole("option", { name, exact: true }).click();
  await expect(calc.getByRole("combobox", { name: "Marchandise" })).toHaveValue(name);
}

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
  await pick(calc, "Biche");
  await calc.getByLabel("Quantité").fill("4");
  await expect(calc.getByTestId("calc-rachat")).toHaveText("8 septims");
  await expect(calc.getByTestId("calc-vente")).toHaveText("12 septims");
  await expect(calc.getByTestId("calc-transfo")).toContainText("1 lot → 2 cuirs");

  await pick(calc, "Venaison");
  await calc.getByLabel("Quantité").fill("200");
  await expect(calc.getByTestId("calc-vente")).toHaveText("400 septims");
  await expect(calc).toContainText("Tarif de gros");
  await expect(calc.getByTestId("calc-benefice")).toHaveText("+200 septims");
});

test("chaque table a sa recherche, qui filtre pendant qu'on tape", async ({ page }) => {
  const peaux = page.getByRole("region", { name: /Tarifs des peaux/ });
  const chasse = page.getByRole("region", { name: /Viandes, venaison et ressources/ });
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toBeVisible();

  const searchPeaux = peaux.getByRole("searchbox", { name: "Chercher une marchandise" });
  const searchChasse = chasse.getByRole("searchbox", { name: "Chercher une marchandise" });
  await expect(page.getByRole("button", { name: "Chercher" })).toHaveCount(0);
  await expect(searchPeaux).toHaveAttribute("placeholder", "Chercher une marchandise");
  // Each bar takes at least half of its panel's width, the table's.
  const bar = (await searchPeaux.boundingBox())!;
  const table = (await peaux.getByRole("table").boundingBox())!;
  expect(bar.width).toBeGreaterThanOrEqual(table.width / 2);
  const panel = (await peaux.boundingBox())!;
  // Leather and the calculator come first, then the tables.
  const cuir = (await page.getByRole("region", { name: "Tarifs du cuir" }).boundingBox())!;
  const calcul = (await page.getByRole("region", { name: "Calculateur des prix" }).boundingBox())!;
  expect(cuir.y).toBeLessThan(panel.y);
  expect(calcul.y).toBeLessThan(panel.y);

  // The hides search filters only the hides.
  await searchPeaux.pressSequentially("ours");
  await expect(page).toHaveURL(/\/tarifs\?peaux=ours$/);
  await expect(peaux.getByRole("row", { name: /^Ours 4 peaux/ })).toBeVisible();
  await expect(peaux.getByRole("row", { name: /Biche/ })).toHaveCount(0);
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toBeVisible();
  // The calculator still offers every priced product.
  const calc = page.getByTestId("calculateur");
  await calc.getByRole("combobox", { name: "Marchandise" }).click();
  await expect(calc.getByRole("option", { name: "Biche", exact: true })).toHaveCount(1);
  await calc.getByRole("combobox", { name: "Marchandise" }).press("Escape");

  // The other search filters the meats and resources, and both hold together.
  await searchChasse.pressSequentially("venaison");
  await expect(page).toHaveURL(/\/tarifs\?peaux=ours&chasse=venaison$/);
  await expect(chasse.getByRole("row", { name: /^Venaison/ })).toBeVisible();
  await expect(chasse.getByText("Aucune marchandise ne correspond.")).toHaveCount(1);
  await expect(peaux.getByRole("row", { name: /^Ours 4 peaux/ })).toBeVisible();
  await expect(peaux.getByRole("row", { name: /Biche/ })).toHaveCount(0);

  await searchPeaux.fill("introuvable-xyz");
  await expect(peaux.getByText("Aucune marchandise ne correspond.")).toBeVisible();
  await searchPeaux.clear();
  await expect(page).toHaveURL(/\/tarifs\?chasse=venaison$/);
  await searchChasse.clear();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();

  // Leaving the search by the menu or the back button shows the URL's query in the field.
  await searchPeaux.pressSequentially("biche");
  await expect(page).toHaveURL(/\/tarifs\?peaux=biche$/);
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Tarifs" }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(peaux.getByRole("row", { name: /^Ours 4 peaux/ })).toBeVisible();
  await expect(searchPeaux).toHaveValue("");
  await page.goBack();
  await expect(page).toHaveURL(/\/tarifs\?peaux=biche$/);
  await expect(searchPeaux).toHaveValue("biche");
});

test("le choix de la marchandise du calculateur se cherche en tapant", async ({ page }) => {
  const calc = page.getByTestId("calculateur");
  const box = calc.getByRole("combobox", { name: "Marchandise" });
  // One field: no separate search box in the calculator.
  await expect(calc.getByRole("searchbox")).toHaveCount(0);
  const before = await box.inputValue();

  await box.fill("venai");
  await expect(calc.getByRole("option")).toHaveText(["Venaison"]);
  await box.press("Enter");
  await expect(box).toHaveValue("Venaison");
  await expect(calc.getByRole("listbox")).toHaveCount(0);
  await calc.getByLabel("Quantité").fill("200");
  await expect(calc.getByTestId("calc-vente")).toHaveText("400 septims");
  // The tables are not filtered by it.
  await expect(page.getByRole("region", { name: /Tarifs des peaux/ }).getByRole("row", { name: /Biche/ })).toBeVisible();

  await box.fill("introuvable-xyz");
  await expect(calc.getByRole("listbox")).toContainText("Aucune marchandise ne correspond.");
  await box.press("Escape");
  await expect(box).toHaveValue("Venaison");
  expect(before).not.toBe("");
});

test("chaque liste montre ses marchandises sans tarif sur demande, dans une table sous son bouton", async ({ page }) => {
  const base = uniqueName("Sans tarif");
  const [peauZ, peauA] = [`${base} zibeline`, `${base} aurochs`];
  const ressource = `${base} résine`;
  await createProduct(peauZ, { buyPrice: null, sellPrice: null });
  await createProduct(peauA, { buyPrice: null, sellPrice: null });
  await createProduct(ressource, { buyPrice: null, sellPrice: null, category: "ressource", unit: "pièce" });
  // The beforeEach click may still be on its way: open the page itself.
  await page.goto("/tarifs");
  const peaux = page.getByRole("region", { name: /Tarifs des peaux/ });
  const chasse = page.getByRole("region", { name: /Viandes, venaison et ressources/ });
  const unpricedPeaux = peaux.getByRole("table", { name: "Marchandises sans tarif" });
  const unpricedChasse = chasse.getByRole("table", { name: "Marchandises sans tarif" });
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();
  // Hidden by default.
  await expect(page.getByText(base)).toHaveCount(0);
  await expect(unpricedPeaux).toHaveCount(0);

  // The button sits under its list, and spins while the products come.
  const showPeaux = peaux.getByRole("link", { name: "Voir les marchandises sans tarif" });
  const table = (await peaux.getByRole("table").boundingBox())!;
  expect((await showPeaux.boundingBox())!.y).toBeGreaterThan(table.y + table.height);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/peaux-sans-tarif=1/, async (route) => {
    await held;
    await route.continue();
  });
  await showPeaux.click();
  await expect(showPeaux.getByTestId("sans-tarif-pending")).toBeVisible();
  release();

  // They come in a table of their own under the button, by name; the priced table doesn't hold them.
  await expect(page).toHaveURL(/\/tarifs\?peaux-sans-tarif=1$/);
  await expect(unpricedPeaux.getByRole("row", { name: new RegExp(base) })).toHaveText([
    new RegExp(peauA),
    new RegExp(peauZ),
  ]);
  const button = (await peaux.getByRole("link", { name: "Masquer les marchandises sans tarif" }).boundingBox())!;
  expect((await unpricedPeaux.boundingBox())!.y).toBeGreaterThan(button.y);
  await expect(peaux.getByRole("table").first().getByText(base)).toHaveCount(0);
  await expect(unpricedChasse).toHaveCount(0);

  // The other list has its own; the search filters it and keeps both choices.
  await chasse.getByRole("link", { name: "Voir les marchandises sans tarif" }).click();
  await expect(page).toHaveURL(/peaux-sans-tarif=1&chasse-sans-tarif=1$/);
  await expect(unpricedChasse.getByRole("row", { name: new RegExp(ressource) })).toContainText("Ressource");
  await chasse.getByRole("searchbox", { name: "Chercher une marchandise" }).pressSequentially("introuvable-xyz");
  await expect(page).toHaveURL(/chasse=/);
  await expect(chasse.getByText("Aucune marchandise sans tarif.")).toBeVisible();

  // Hiding them again keeps the search and the other list's choice.
  await peaux.getByRole("link", { name: "Masquer les marchandises sans tarif" }).click();
  await expect(page).not.toHaveURL(/peaux-sans-tarif/);
  await expect(page).toHaveURL(/chasse-sans-tarif=1/);
  await expect(unpricedPeaux).toHaveCount(0);
  await expect(chasse.getByText("Aucune marchandise sans tarif.")).toBeVisible();
  await chasse.getByRole("link", { name: "Masquer les marchandises sans tarif" }).click();
  await expect(page).toHaveURL(/\/tarifs\?chasse=[^&]+$/);
  await expect(chasse.getByText("Aucune marchandise sans tarif.")).toHaveCount(0);
});

test("un gérant modifie un tarif par le crayon de sa ligne, et revient aux tarifs", async ({ page, browser }) => {
  const name = uniqueName("Viande au crayon");
  await createProduct(name, { buyPrice: 2, sellPrice: 3, category: "viande", unit: "pièce" });
  // The beforeEach click may still be on its way: open the page itself.
  await page.goto("/tarifs");
  const chasse = page.getByRole("region", { name: /Viandes, venaison et ressources/ });
  const row = chasse.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("3 septims");

  await row.getByRole("link", { name: `Modifier ${name}` }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "← Tarifs" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Prix en septims" }).nth(1).fill("7");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(chasse.getByRole("row", { name: new RegExp(name) })).toContainText("7 septims");

  // The hides have their pencil too.
  await expect(
    page.getByRole("region", { name: /Tarifs des peaux/ }).getByRole("row", { name: /Biche/ }).getByRole("link", { name: "Modifier Biche" }),
  ).toBeVisible();

  // Opened from Gérer les tarifs, saving still goes back there.
  await page.goto("/marchandises?q=" + encodeURIComponent(name));
  await page.getByRole("link", { name: `Modifier ${name}` }).click();
  await expect(page.getByRole("link", { name: "← Gérer les tarifs" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page).toHaveURL(/\/marchandises$/);

  // An employee sees the prices without pencils.
  const { page: employee } = await newEmployeePage(browser, "einar");
  await employee.goto("/tarifs");
  await expect(employee.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  await expect(employee.getByRole("link", { name: /^Modifier / })).toHaveCount(0);
});
