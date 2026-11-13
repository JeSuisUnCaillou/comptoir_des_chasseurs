import { expect, test, type Locator, type Page } from "@playwright/test";
import { createProduct, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

/** Picks a product in the calculator by typing its name and clicking it in the list. */
async function pick(calc: Locator, name: string) {
  await calc.getByRole("combobox", { name: "Marchandise" }).fill(name);
  await calc.getByRole("option", { name, exact: true }).click();
  await expect(calc.getByRole("combobox", { name: "Marchandise" })).toHaveValue(name);
}

/** The grids of the hunting products, by category, in page order. */
function grids(page: Page) {
  return {
    peaux: page.getByRole("region", { name: "Peaux", exact: true }),
    viandes: page.getByRole("region", { name: "Viandes et venaison" }),
    ressources: page.getByRole("region", { name: "Autres ressources" }),
  };
}

test.beforeEach(async ({ page }) => {
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Tarifs" }).click();
});

test("la grille des peaux affiche transformation et bénéfice par lot", async ({ page }) => {
  const { peaux } = grids(page);
  const biche = peaux.getByRole("row", { name: /Biche/ });
  await expect(biche).toContainText("4 peaux → 2 cuirs");
  await expect(biche).toContainText("+4 septims");
  const ours = peaux.getByRole("row", { name: /^Ours 4 peaux/ });
  await expect(ours).toContainText("+12 septims");
  await expect(peaux).toContainText("rachat du cuir par le forgeron : 6 septims");
});

test("les ressources affichent un bénéfice sur des lots entiers", async ({ page }) => {
  const { viandes, ressources } = grids(page);
  await expect(ressources.getByRole("row", { name: /Flèches d'acier/ })).toContainText(
    "+85 septims pour 880 unités",
  );
  await expect(viandes.getByRole("row", { name: /^Venaison/ })).toContainText(
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

test("une seule recherche pour toutes les grilles, qui ne montre que les catégories trouvées", async ({ page }) => {
  const block = page.getByRole("region", { name: "Grille des prix" });
  const { peaux, viandes, ressources } = grids(page);
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();
  await expect(viandes.getByRole("row", { name: /^Venaison/ })).toBeVisible();
  await expect(ressources.getByRole("row", { name: /Flèches d'acier/ })).toBeVisible();

  // One search bar for the whole block, above the grids, peaux first.
  const search = block.getByRole("searchbox", { name: "Chercher une marchandise" });
  await expect(page.getByRole("searchbox")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Chercher" })).toHaveCount(0);
  await expect(search).toHaveAttribute("placeholder", "Chercher une marchandise");
  await expect(block).toContainText("Marchandises");
  const bar = (await search.boundingBox())!;
  const [p, v, r] = [(await peaux.boundingBox())!, (await viandes.boundingBox())!, (await ressources.boundingBox())!];
  expect(bar.y).toBeLessThan(p.y);
  expect(p.y).toBeLessThan(v.y);
  expect(v.y).toBeLessThan(r.y);
  // The bar takes at least half of the grids' width.
  expect(bar.width).toBeGreaterThanOrEqual(p.width / 2);
  // Leather and the calculator come first, then the grids.
  const cuir = (await page.getByRole("region", { name: "Cuir", exact: true }).boundingBox())!;
  const calcul = (await page.getByRole("region", { name: "Calculateur des prix" }).boundingBox())!;
  expect(cuir.y).toBeLessThan(p.y);
  expect(calcul.y).toBeLessThan(p.y);

  // A hide: only the Peaux grid stays.
  await search.pressSequentially("ours");
  await expect(page).toHaveURL(/\/tarifs\?q=ours$/);
  await expect(peaux.getByRole("row", { name: /^Ours 4 peaux/ })).toBeVisible();
  await expect(peaux.getByRole("row", { name: /Biche/ })).toHaveCount(0);
  await expect(viandes).toHaveCount(0);
  await expect(ressources).toHaveCount(0);
  await expect(page.getByText("Aucune marchandise ne correspond.")).toHaveCount(0);
  // The calculator still offers every priced product.
  const calc = page.getByTestId("calculateur");
  await calc.getByRole("combobox", { name: "Marchandise" }).click();
  await expect(calc.getByRole("option", { name: "Biche", exact: true })).toHaveCount(1);
  await calc.getByRole("combobox", { name: "Marchandise" }).press("Escape");

  // A meat: only its grid.
  await search.fill("venaison");
  await expect(page).toHaveURL(/\/tarifs\?q=venaison$/);
  await expect(viandes.getByRole("row", { name: /^Venaison/ })).toBeVisible();
  await expect(peaux).toHaveCount(0);
  await expect(ressources).toHaveCount(0);

  // Nothing found: one message, no category.
  await search.fill("introuvable-xyz");
  await expect(block.getByText("Aucune marchandise ne correspond.")).toHaveCount(1);
  await expect(block.getByRole("heading", { level: 3 })).toHaveCount(0);
  await search.clear();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();
  await expect(ressources).toBeVisible();

  // Leaving the search by the menu or the back button shows the URL's query in the field.
  await search.pressSequentially("biche");
  await expect(page).toHaveURL(/\/tarifs\?q=biche$/);
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Tarifs" }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(peaux.getByRole("row", { name: /^Ours 4 peaux/ })).toBeVisible();
  await expect(search).toHaveValue("");
  await page.goBack();
  await expect(page).toHaveURL(/\/tarifs\?q=biche$/);
  await expect(search).toHaveValue("biche");
});

test("une recherche montre chaque catégorie où elle trouve, et seulement celles-là", async ({ page }) => {
  const base = uniqueName("Troll");
  await createProduct(`${base} peau`);
  await createProduct(`${base} gigot`, { category: "Viandes et venaison", unit: "pièce" });
  await page.goto(`/tarifs?q=${encodeURIComponent(base)}`);
  const { peaux, viandes, ressources } = grids(page);
  await expect(peaux.getByRole("row", { name: new RegExp(`${base} peau`) })).toBeVisible();
  await expect(viandes.getByRole("row", { name: new RegExp(`${base} gigot`) })).toBeVisible();
  await expect(ressources).toHaveCount(0);
});

test("le calculateur a le cuir choisi par défaut", async ({ page }) => {
  const calc = page.getByTestId("calculateur");
  await expect(calc.getByRole("combobox", { name: "Marchandise" })).toHaveValue("Cuir");
});

test("les tarifs du cuir et le calculateur finissent à la même hauteur", async ({ page }) => {
  await page.setViewportSize({ width: 1300, height: 900 });
  const cuir = page.getByRole("region", { name: "Cuir", exact: true });
  const calcul = page.getByRole("region", { name: "Calculateur des prix" });
  await expect(page.getByTestId("calculateur")).toBeVisible();
  const a = (await cuir.boundingBox())!;
  const b = (await calcul.boundingBox())!;
  expect(a.y).toBeCloseTo(b.y, 0);
  expect(a.y + a.height).toBeCloseTo(b.y + b.height, 0);
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
  await expect(grids(page).peaux.getByRole("row", { name: /Biche/ })).toBeVisible();

  await box.fill("introuvable-xyz");
  await expect(calc.getByRole("listbox")).toContainText("Aucune marchandise ne correspond.");
  await box.press("Escape");
  await expect(box).toHaveValue("Venaison");
  expect(before).not.toBe("");
});

test("les marchandises sans tarif de toutes les catégories se montrent sur demande, sous les grilles", async ({ page }) => {
  const base = uniqueName("Sans tarif");
  const [peauZ, peauA] = [`${base} zibeline`, `${base} aurochs`];
  const ressource = `${base} résine`;
  await createProduct(peauZ, { buyPrice: null, sellPrice: null });
  await createProduct(peauA, { buyPrice: null, sellPrice: null });
  await createProduct(ressource, { buyPrice: null, sellPrice: null, category: "Autres ressources", unit: "pièce" });
  // The beforeEach click may still be on its way: open the page itself.
  await page.goto("/tarifs");
  const block = page.getByRole("region", { name: "Grille des prix" });
  const unpriced = block.getByRole("table", { name: "Marchandises sans tarif" });
  const { peaux, ressources } = grids(page);
  await expect(peaux.getByRole("row", { name: /Biche/ })).toBeVisible();
  // Hidden by default, one button for the whole block.
  await expect(page.getByText(base)).toHaveCount(0);
  await expect(unpriced).toHaveCount(0);
  const show = block.getByRole("link", { name: "Voir les marchandises sans tarif" });
  await expect(show).toHaveCount(1);

  // The button sits under the last grid, and spins while the products come.
  const last = (await ressources.boundingBox())!;
  expect((await show.boundingBox())!.y).toBeGreaterThan(last.y + last.height - 1);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/sans-tarif=1/, async (route) => {
    await held;
    await route.continue();
  });
  await show.click();
  await expect(show.getByTestId("sans-tarif-pending")).toBeVisible();
  release();

  // They come in a table of their own under the button, by name, with their category.
  await expect(page).toHaveURL(/\/tarifs\?sans-tarif=1$/);
  await expect(unpriced.getByRole("row", { name: new RegExp(base) })).toHaveText([
    new RegExp(peauA),
    new RegExp(ressource),
    new RegExp(peauZ),
  ]);
  await expect(unpriced.getByRole("row", { name: new RegExp(peauA) })).toContainText("Peaux");
  await expect(unpriced.getByRole("row", { name: new RegExp(ressource) })).toContainText("Autres ressources");
  const button = (await block.getByRole("link", { name: "Masquer les marchandises sans tarif" }).boundingBox())!;
  expect((await unpriced.boundingBox())!.y).toBeGreaterThan(button.y);
  await expect(peaux.getByText(base)).toHaveCount(0);

  await block.getByRole("link", { name: "Masquer les marchandises sans tarif" }).click();
  await expect(page).toHaveURL(/\/tarifs$/);
  await expect(unpriced).toHaveCount(0);
});

test("une recherche à moins de 10 résultats montre d'office les marchandises sans tarif", async ({ page }) => {
  const few = uniqueName("Peu");
  const many = uniqueName("Beaucoup");
  await createProduct(`${few} sans tarif`, { buyPrice: null, sellPrice: null });
  await createProduct(`${few} avec tarif`);
  await createProduct(`${many} sans tarif`, { buyPrice: null, sellPrice: null });
  for (let i = 1; i <= 9; i++) await createProduct(`${many} avec tarif ${i}`);
  await page.goto("/tarifs");
  const peaux = page.getByRole("region", { name: "Grille des prix" });
  const unpriced = peaux.getByRole("table", { name: "Marchandises sans tarif" });
  const search = peaux.getByRole("searchbox", { name: "Chercher une marchandise" });

  // 2 results: the one without a price shows by itself, with no button.
  await search.pressSequentially(few);
  await expect(unpriced.getByRole("row", { name: new RegExp(`${few} sans tarif`) })).toBeVisible();
  await expect(peaux.getByRole("row", { name: new RegExp(`${few} avec tarif`) })).toBeVisible();
  await expect(peaux.getByRole("link", { name: /les marchandises sans tarif/ })).toHaveCount(0);
  await expect(page).not.toHaveURL(/sans-tarif=/);

  // 10 results, the one without a price included: back to the button.
  await search.fill(many);
  await expect(peaux.getByRole("row", { name: new RegExp(`${many} avec tarif 9`) })).toBeVisible();
  await expect(unpriced).toHaveCount(0);
  await peaux.getByRole("link", { name: "Voir les marchandises sans tarif" }).click();
  await expect(unpriced.getByRole("row", { name: new RegExp(`${many} sans tarif`) })).toBeVisible();

  // A search that finds nothing adds nothing more.
  await search.fill("introuvable-xyz");
  await expect(peaux.getByText("Aucune marchandise ne correspond.")).toBeVisible();
  await expect(peaux.getByText("Aucune marchandise sans tarif.")).toHaveCount(0);

  // A search that finds only products without a price shows them, and no « aucun résultat ».
  await search.fill(`${few} sans`);
  await expect(unpriced.getByRole("row", { name: new RegExp(`${few} sans tarif`) })).toBeVisible();
  await expect(peaux.getByRole("heading", { level: 3 })).toHaveCount(0);
  await expect(peaux.getByText(/Aucune marchandise/)).toHaveCount(0);
});

test("un gérant modifie un tarif par le crayon de sa ligne, et revient aux tarifs", async ({ page, browser }) => {
  const name = uniqueName("Viande au crayon");
  await createProduct(name, { buyPrice: 2, sellPrice: 3, category: "Viandes et venaison", unit: "pièce" });
  // The beforeEach click may still be on its way: open the page itself.
  await page.goto("/tarifs");
  const chasse = grids(page).viandes;
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
    grids(page).peaux.getByRole("row", { name: /Biche/ }).getByRole("link", { name: "Modifier Biche" }),
  ).toBeVisible();

  // Opened from Gérer les marchandises, saving still goes back there.
  await page.goto("/marchandises?q=" + encodeURIComponent(name));
  await page.getByRole("link", { name: `Modifier ${name}` }).click();
  await expect(page.getByRole("link", { name: "← Gérer les marchandises" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page).toHaveURL(/\/marchandises$/);

  // An employee sees the prices without pencils.
  const { page: employee } = await newEmployeePage(browser, "einar");
  await employee.goto("/tarifs");
  await expect(employee.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  await expect(employee.getByRole("link", { name: /^Modifier / })).toHaveCount(0);
});

test("un clic sur un en-tête trie la grille, un second clic dans l'autre sens", async ({ page }) => {
  const tag = uniqueName("Tri tarifs");
  // 2 septims for 4 units is cheaper per unit than 1 septim for one.
  await createProduct(`${tag} Aiguille`, { category: "Autres ressources", unit: "unité", buyPrice: 2, buyQty: 4, sellPrice: 3 });
  await createProduct(`${tag} bois`, { category: "Autres ressources", unit: "unité", buyPrice: 1, sellPrice: 1 });
  await createProduct(`${tag} Cire`, { category: "Autres ressources", unit: "unité", buyPrice: null, sellPrice: 2 });
  await page.goto(`/tarifs?q=${encodeURIComponent(tag)}`);
  const { ressources } = grids(page);
  const names = ressources.locator("tbody td.stack-title");
  await expect(names).toHaveText([`${tag} Aiguille`, `${tag} bois`, `${tag} Cire`]);

  const vente = ressources.getByRole("button", { name: "Vente", exact: true });
  await vente.click();
  await expect(names).toHaveText([`${tag} bois`, `${tag} Cire`, `${tag} Aiguille`]);
  await expect(ressources.getByRole("columnheader", { name: "Vente", exact: true })).toHaveAttribute("aria-sort", "ascending");
  await vente.click();
  await expect(names).toHaveText([`${tag} Aiguille`, `${tag} Cire`, `${tag} bois`]);
  await expect(ressources.getByRole("columnheader", { name: "Vente", exact: true })).toHaveAttribute("aria-sort", "descending");

  // Per unit, and the one without a buyback price stays last both ways.
  const rachat = ressources.getByRole("button", { name: "Rachat", exact: true });
  await rachat.click();
  await expect(names).toHaveText([`${tag} Aiguille`, `${tag} bois`, `${tag} Cire`]);
  await rachat.click();
  await expect(names).toHaveText([`${tag} bois`, `${tag} Aiguille`, `${tag} Cire`]);

  // Names ignore case: "bois" between "Aiguille" and "Cire".
  const nom = ressources.getByRole("button", { name: "Marchandise", exact: true });
  await nom.click();
  await nom.click();
  await expect(names).toHaveText([`${tag} Cire`, `${tag} bois`, `${tag} Aiguille`]);
});
