import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import {
  createMember,
  createProduct,
  createTransactions,
  loginAs,
  loginAsGerant,
  newEmployeePage,
  pickProduct,
  setRole,
  uniqueName,
} from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

/** Writes a line through its form; the form then brings the member back to the register. */
async function record(
  page: Page,
  kind: "vente" | "achat",
  { product, quantity, counterparty }: { product: string; quantity: number; counterparty?: string },
) {
  await page.goto(`/achat-vente/${kind}`);
  const form = page.getByRole("region", { name: kind === "vente" ? "Inscrire une vente" : "Inscrire un achat" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill(String(quantity));
  // The tariff fills the amount on its own.
  await expect(form.getByLabel("Montant (septims)")).not.toHaveValue("");
  if (counterparty) await form.getByLabel("Nom du client / vendeur RP (facultatif)").fill(counterparty);
  await form.getByRole("button", { name: kind === "vente" ? "Confirmer la vente" : "Confirmer l'achat" }).click();
  await expect(page).toHaveURL(/\/achat-vente\?inscrit=\d+$/);
  const status = page.getByRole("status").filter({ hasText: `${quantity} × ${product}` });
  await expect(status).toBeVisible();
  return status;
}

async function stockOf(page: Page, product: string) {
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(product);
  return page.getByTestId(`stock-${product}`).getByTestId("stock-value");
}

test("un achat puis une vente mettent à jour le stock et le registre", async ({ browser }) => {
  const product = uniqueName("Peau de dragon");
  await createProduct(product, { buyPrice: 2, sellPrice: 3 });
  const { page } = await newEmployeePage(browser, "brelyna");

  await expect(await record(page, "achat", { product, quantity: 10, counterparty: "Aela" })).toHaveText(
    `Achat inscrit : 10 × ${product}, 20 septims.`,
  );
  await expect(page.getByTestId("registre").locator("tr.fresh")).toContainText("Aela");
  await expect(await record(page, "vente", { product, quantity: 4, counterparty: "Belethor" })).toContainText(
    "12 septims",
  );

  await expect(await stockOf(page, product)).toHaveText("6");

  await page.getByRole("link", { name: "Achat / Vente" }).click();
  const rows = page.getByTestId("registre").getByRole("row").filter({ hasText: product });
  await expect(rows.filter({ hasText: "Belethor" })).toContainText(/Vente.*4.*\+12 septims/);
  await expect(rows.filter({ hasText: "Aela" })).toContainText(/Achat.*10.*−20 septims/);

  await page.getByLabel("Opération").selectOption("rachat");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/type=rachat/);
  await expect(rows.filter({ hasText: "Aela" })).toBeVisible();
  await expect(rows.filter({ hasText: "Belethor" })).toHaveCount(0);
});

test("une vente ne peut pas dépasser le stock", async ({ browser }) => {
  const product = uniqueName("Peau de loup-garou");
  await createProduct(product, { stock: 2 });
  const { page } = await newEmployeePage(browser, "onmund");
  await page.goto("/achat-vente");
  await page.getByRole("link", { name: /Nouvelle vente/ }).click();
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form, product);
  await expect(form.getByTestId("stock-dispo")).toHaveText("En stock : 2 peaux");
  await form.getByLabel("Quantité").fill("5");
  await expect(form.locator(ALERT)).toContainText("il ne reste que 2 peaux");
  await expect(form.getByRole("button", { name: "Confirmer la vente" })).toBeDisabled();
});

test("un article hors stock s'inscrit avec son nom", async ({ browser }) => {
  const label = uniqueName("Trophée de dragon");
  const { page } = await newEmployeePage(browser, "j-zargo");
  await page.goto("/achat-vente");
  await page.getByRole("link", { name: /Nouvelle vente/ }).click();
  // The form has a page of its own, without the register.
  await expect(page).toHaveURL(/\/achat-vente\/vente$/);
  await expect(page.getByRole("heading", { name: "Nouvelle vente", level: 1 })).toBeVisible();
  await expect(page.getByTestId("registre")).toHaveCount(0);
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  // No explanatory sentence about the amount under the lines.
  await expect(form.getByText("Le montant de chaque marchandise")).toHaveCount(0);
  await pickProduct(form, "Autre article (hors stock)…");
  await form.getByLabel("Nom de l'article").fill(label);
  await form.getByLabel("Montant (septims)").fill("500");
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: label })).toHaveText(
    `Vente inscrite : 1 × ${label}, 500 septims.`,
  );
  await expect(
    page.getByTestId("registre").getByRole("row").filter({ hasText: label }),
  ).toContainText("+500 septims");
});

test("la marchandise d'une vente ou d'un achat se cherche en tapant", async ({ browser }) => {
  const product = uniqueName("Peau de mammouth");
  await createProduct(product, { stock: 3 });
  const { page } = await newEmployeePage(browser, "faralda");
  for (const [kind, region, submit] of [
    ["vente", "Inscrire une vente", "Confirmer la vente"],
    ["achat", "Inscrire un achat", "Confirmer l'achat"],
  ] as const) {
    await page.goto(`/achat-vente/${kind}`);
    const form = page.getByRole("region", { name: region });
    const box = form.getByRole("combobox", { name: "Article ou marchandise" });
    // Nothing chosen yet: the form is refused.
    await form.getByRole("button", { name: submit }).click();
    await expect(page).toHaveURL(new RegExp(`/achat-vente/${kind}$`));
    await expect(box).toHaveValue("");

    // The list keeps the categories and ends with the item outside the stock.
    await box.click();
    await expect(form.getByRole("listbox")).toContainText("Peaux");
    await expect(form.getByRole("option").last()).toHaveText("Autre article (hors stock)…");

    // Typing filters; Enter picks the product.
    await box.fill(product.slice(-12));
    await expect(form.getByRole("option")).toHaveText([product, "Autre article (hors stock)…"]);
    await box.press("Enter");
    await expect(box).toHaveValue(product);
    await expect(form.getByRole("listbox")).toHaveCount(0);
    await expect(form.getByTestId("stock-dispo")).toHaveText("En stock : 3 peaux");
    await expect(form.getByLabel("Montant (septims)")).not.toHaveValue("");

    // A name typed without picking anything keeps the product already chosen.
    await box.fill("introuvable-xyz");
    await expect(form.getByRole("listbox")).toContainText("Aucune marchandise ne correspond.");
    // Enter does not pick "Autre article" behind the member's back.
    await box.press("Enter");
    await expect(form.getByLabel("Nom de l'article")).toHaveCount(0);
    await box.press("Escape");
    await expect(box).toHaveValue(product);
  }
});

test("annuler une ligne rétablit le stock, et seul l'auteur ou un gérant le peut", async ({ page, browser }) => {
  const product = uniqueName("Peau de smilodon");
  await createProduct(product, { stock: 5 });
  const { page: author } = await newEmployeePage(browser, "tolfdir");
  const { page: colleague } = await newEmployeePage(browser, "urag");
  await record(author, "vente", { product, quantity: 3 });
  await expect(await stockOf(author, product)).toHaveText("2");

  // A colleague cannot cancel someone else's line; a gérant can.
  await colleague.goto("/achat-vente");
  const theirRow = colleague.getByTestId("registre").getByRole("row").filter({ hasText: product });
  await expect(theirRow).toBeVisible();
  await expect(theirRow.getByRole("button", { name: /Annuler/ })).toHaveCount(0);
  await loginAsGerant(page);
  await page.goto("/achat-vente");
  await expect(
    page.getByTestId("registre").getByRole("row").filter({ hasText: product }).getByRole("button", { name: /Annuler/ }),
  ).toBeVisible();

  await author.goto("/achat-vente");
  const row = author.getByTestId("registre").getByRole("row").filter({ hasText: product });
  author.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: /Annuler/ }).click();
  await expect(row).toContainText("Annulée par");
  await expect(row.getByRole("button", { name: /Annuler/ })).toHaveCount(0);
  await expect(await stockOf(author, product)).toHaveText("5");
});

// The hidden button is not the only guard: the server refuses too. A gérant
// demoted while the register is open still sees the button, and is refused.
test("le serveur refuse d'annuler la ligne d'un autre à qui n'est plus gérant", async ({ browser }) => {
  const product = uniqueName("Peau de horqueur");
  await createProduct(product, { stock: 5 });
  const { page: author } = await newEmployeePage(browser, "onmund");
  await record(author, "vente", { product, quantity: 2 });

  const username = uniqueName("faralda").toLowerCase();
  await createMember(username, "mot-de-passe", "gerant");
  const page = await (await browser.newContext()).newPage();
  await loginAs(page, username, "mot-de-passe");
  await page.goto("/achat-vente");
  const row = page.getByTestId("registre").getByRole("row").filter({ hasText: product });
  const cancel = row.getByRole("button", { name: /Annuler/ });
  await expect(cancel).toBeVisible();

  await setRole(username, "employe");
  page.once("dialog", (dialog) => dialog.accept());
  await cancel.click();
  await expect(row.locator(ALERT)).toHaveText("Seul un gérant peut annuler la ligne d'un autre membre.");
  await page.reload();
  await expect(row).not.toContainText("Annulée par");
  await expect(await stockOf(page, product)).toHaveText("3");
});

test("le grand livre montre la caisse et les dernières écritures", async ({ browser }) => {
  const product = uniqueName("Peau de mammouth");
  await createProduct(product, { buyPrice: 5, sellPrice: 8, stock: 3 });
  const { page } = await newEmployeePage(browser, "faralda");
  await record(page, "vente", { product, quantity: 2 });

  await page.getByRole("link", { name: "Grand livre" }).click();
  await expect(page.getByTestId("caisse-jour")).toContainText("Aujourd'hui");
  await expect(page.getByTestId("caisse-jour")).toContainText(/septims? encaissés/);
  await expect(page.getByTestId("caisse-semaine")).toContainText("7 derniers jours");
  await expect(page.getByTestId("caisse-totale")).toContainText("Trésorerie actuelle");
  await expect(page.getByTestId("registre").getByRole("row").filter({ hasText: product })).toContainText(
    "+16 septims",
  );
});

test("le grand livre met l'achat et la vente en avant, pas le mouvement de caisse", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "brand-shei");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Nouvel achat" })).toHaveClass(/btn-primary/);
  await expect(page.getByRole("link", { name: "Nouvelle vente" })).toHaveClass(/btn-primary/);
  await expect(page.getByRole("link", { name: "Mouvement de caisse" })).not.toHaveClass(/btn-primary/);
});

test("le registre est paginé", async ({ browser }) => {
  const { page, username } = await newEmployeePage(browser, "mjoll");
  await createTransactions(username, 30);
  await page.getByRole("link", { name: "Achat / Vente" }).click();
  const pages = page.getByRole("navigation", { name: "Pages du registre" });
  await expect(pages).toContainText(/Page 1 sur \d+/);
  await expect(page.getByTestId("registre").locator("tbody tr")).toHaveCount(25);
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pages).toContainText(/Page 2 sur \d+/);
  await pages.getByRole("link", { name: "Précédent" }).click();
  await expect(pages).toContainText(/Page 1 sur/);
});

test("le filtre par dates et la caisse de la sélection, annulation comprise", async ({ page, browser }) => {
  // A day of its own, years back, so no other test writes on it.
  const day = `2020-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`;
  const { username } = await newEmployeePage(browser, "ralof");
  await createTransactions(username, 3, { at: `'${day}T12:00:00+01:00'::timestamptz`, amount: 7, label: "Vente du passé" });

  await loginAsGerant(page);
  await page.goto("/achat-vente");
  await page.getByLabel("Du", { exact: true }).fill(day);
  await page.getByLabel("Au", { exact: true }).fill(day);
  await page.getByRole("button", { name: "Filtrer" }).click();
  const table = page.getByTestId("registre");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByTestId("totaux-registre")).toContainText("+21 septims");

  // A wider range still finds them, written either way round.
  await page.goto(`/achat-vente?au=${day}&du=2019-01-01`);
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await page.goto(`/achat-vente?du=${day}&au=2019-01-01`);
  await expect(table.locator("tbody tr")).toHaveCount(3);

  // A cancelled line leaves the till.
  await page.goto(`/achat-vente?du=${day}&au=${day}`);
  page.once("dialog", (dialog) => dialog.accept());
  await table.locator("tbody tr").first().getByRole("button", { name: /Annuler/ }).click();
  await expect(table.locator("tbody tr").first()).toContainText("Annulée par Lomone");
  await expect(page.getByTestId("totaux-registre")).toContainText("+14 septims");
});

test("le montant suit le tarif, et le crayon permet de le changer", async ({ browser }) => {
  const product = uniqueName("Peau de horqueur");
  await createProduct(product, { buyPrice: 2, sellPrice: 3, stock: 10 });
  const { page } = await newEmployeePage(browser, "lydia");
  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  const amount = form.getByLabel("Montant (septims)");
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill("4");
  await expect(amount).toHaveValue("12");
  await expect(amount).not.toBeEditable();
  await form.getByLabel("Quantité").fill("5");
  await expect(amount).toHaveValue("15");

  await form.getByRole("button", { name: "Modifier le montant" }).click();
  await expect(amount).toBeEditable();
  await amount.fill("13");
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: product })).toHaveText(
    `Vente inscrite : 5 × ${product}, 13 septims.`,
  );
});

test("le grand livre compte chaque ligne dans la bonne fenêtre", async ({ page, browser }) => {
  // Amounts far above what other tests write, so their lines cannot blur the
  // deltas: a purchase they record meanwhile only takes a few septims off.
  const { username } = await newEmployeePage(browser, "brynjolf");
  const till = async () => {
    await page.goto("/");
    const read = async (id: string) =>
      Number(((await page.getByTestId(id).locator(".stat-value").textContent()) ?? "").replace(/\D/g, ""));
    return { day: await read("caisse-jour"), week: await read("caisse-semaine"), all: await read("caisse-totale") };
  };
  await loginAsGerant(page);
  const before = await till();
  await createTransactions(username, 1, { at: "now() - interval '4 days'", amount: 100_000 });
  await createTransactions(username, 1, { at: "now() - interval '8 days'", amount: 1_000_000 });
  const after = await till();

  expect(after.day - before.day).toBeLessThan(100_000); // neither line is today
  expect(after.week - before.week).toBeGreaterThan(90_000); // 4 days ago is in the week
  expect(after.week - before.week).toBeLessThan(1_000_000); // 8 days ago is not
  expect(after.all - before.all).toBeGreaterThan(1_090_000);
});

test("annuler un achat retire la marchandise, sauf si elle est déjà vendue", async ({ browser }) => {
  const kept = uniqueName("Peau de sabrecat");
  const sold = uniqueName("Peau de troll");
  await createProduct(kept, { buyPrice: 2, sellPrice: 3 });
  await createProduct(sold, { buyPrice: 2, sellPrice: 3 });
  const { page } = await newEmployeePage(browser, "camilla");
  await record(page, "achat", { product: kept, quantity: 4 });
  await record(page, "achat", { product: sold, quantity: 10 });
  await record(page, "vente", { product: sold, quantity: 8 });

  // Goods still in stock leave it again.
  await page.goto("/achat-vente?type=rachat");
  const keptRow = page.getByTestId("registre").getByRole("row").filter({ hasText: kept });
  page.once("dialog", (dialog) => dialog.accept());
  await keptRow.getByRole("button", { name: /Annuler/ }).click();
  await expect(keptRow).toContainText("Annulée par");
  await expect(await stockOf(page, kept)).toHaveText("0");

  // Goods already sold cannot come back out: the line stays.
  await page.goto("/achat-vente?type=rachat");
  const soldRow = page.getByTestId("registre").getByRole("row").filter({ hasText: sold });
  page.once("dialog", (dialog) => dialog.accept());
  await soldRow.getByRole("button", { name: /Annuler/ }).click();
  await expect(soldRow.locator(ALERT)).toContainText("la marchandise rachetée a déjà été vendue");
  await expect(soldRow).not.toContainText("Annulée par");
  await expect(await stockOf(page, sold)).toHaveText("2");
});

/** "1 240 septims" → 1240. */
function septimsValue(text: string) {
  return Number(text.replace(/[^\d−-]/g, "").replace("−", "-"));
}

test("un mouvement de caisse fait entrer ou sortir des septims sans marchandise", async ({ browser }) => {
  const reason = uniqueName("Salaires");
  const deposit = uniqueName("Apport du gérant");
  const { page } = await newEmployeePage(browser, "farengar");
  // Only this test writes movements: the till of the movements alone is ours to watch.
  const movementsTill = async () =>
    septimsValue((await page.getByTestId("totaux-registre").locator(".stat-value").textContent())!);
  await page.goto("/achat-vente?type=caisse");
  const tillBefore = await movementsTill();
  await page.getByRole("link", { name: /Mouvement de caisse/ }).click();
  await expect(page).toHaveURL(/\/achat-vente\/caisse$/);
  const form = page.getByRole("region", { name: "Inscrire un mouvement de caisse" });

  // The form shows the till before and after the movement.
  const preview = form.getByTestId("apercu-caisse");
  const before = septimsValue((await preview.textContent())!.split("→")[0]);
  await form.getByRole("radio", { name: "Sortie d'argent" }).check();
  await form.getByLabel("Montant (septims)").fill("37");
  await expect(preview).toContainText(`→ après : ${before - 37 < 0 ? "−" : ""}`);
  expect(septimsValue((await preview.textContent())!.split("après :")[1])).toBe(before - 37);

  // The reason is required.
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page).toHaveURL(/\/achat-vente\/caisse$/);
  await form.getByLabel("Motif").fill(reason);
  await form.getByLabel("Pour / de la part de (facultatif)").fill("Ralof");
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page).toHaveURL(/\/achat-vente\?inscrit=\d+$/);
  await expect(page.getByRole("status")).toHaveText(`Mouvement inscrit : ${reason}, −37 septims.`);
  const row = page.getByTestId("registre").getByRole("row").filter({ hasText: reason });
  await expect(row).toContainText(/Caisse.*—.*−37 septims.*Ralof/);

  // Money in, too, from the Grand livre's button.
  await page.getByRole("link", { name: "Grand livre" }).click();
  await page.getByRole("link", { name: /Mouvement de caisse/ }).click();
  await expect(page).toHaveURL(/\/achat-vente\/caisse$/);
  await form.getByRole("radio", { name: "Entrée d'argent" }).check();
  await form.getByLabel("Montant (septims)").fill("50");
  await form.getByLabel("Motif").fill(deposit);
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page.getByRole("status")).toHaveText(`Mouvement inscrit : ${deposit}, +50 septims.`);

  // The filter shows the movements alone, and the till counts them.
  await page.getByLabel("Opération").selectOption("caisse");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/type=caisse/);
  const table = page.getByTestId("registre");
  await expect(table.getByRole("row").filter({ hasText: reason })).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: deposit })).toBeVisible();
  await expect(table.getByRole("row").filter({ hasText: /Vente|Achat/ })).toHaveCount(0);
  await expect(page.getByTestId("totaux-registre")).toContainText("en mouvements de caisse");
  expect(await movementsTill()).toBe(tillBefore + 50 - 37);

  // Its author cancels it: it no longer counts.
  page.once("dialog", (dialog) => dialog.accept());
  await table.getByRole("row").filter({ hasText: reason }).getByRole("button", { name: /Annuler/ }).click();
  await expect(table.getByRole("row").filter({ hasText: reason })).toContainText("Annulée");
  await expect.poll(movementsTill).toBe(tillBefore + 50);
});

test("le grand livre montre la trésorerie, les ventes, les rachats et leur solde", async ({ page, browser }) => {
  // Amounts far above what other tests write, so their lines cannot blur the deltas.
  const { username } = await newEmployeePage(browser, "hadvar");
  const tiles = async () => {
    await page.goto("/");
    const read = async (id: string) =>
      septimsValue((await page.getByTestId(id).locator(".stat-value").textContent())!);
    return {
      treasury: await read("caisse-totale"),
      sales: await read("total-ventes"),
      buybacks: await read("total-rachats"),
      margin: await read("solde-ventes-rachats"),
    };
  };
  await loginAsGerant(page);
  await expect(page.getByTestId("caisse-totale")).toContainText("Trésorerie actuelle");
  await expect(page.getByTestId("caisse-totale")).toContainText("Solde calculé depuis les écritures");
  await expect(page.getByTestId("total-ventes")).toContainText("Total des ventes");
  await expect(page.getByTestId("total-rachats")).toContainText("Total des rachats");
  await expect(page.getByTestId("solde-ventes-rachats")).toContainText("Solde ventes − rachats");

  const before = await tiles();
  await createTransactions(username, 1, { amount: 5_000_000 });
  await createTransactions(username, 1, { amount: 2_000_000, kind: "rachat" });
  const after = await tiles();

  const near = (delta: number, expected: number) => {
    expect(delta).toBeGreaterThan(expected - 10_000);
    expect(delta).toBeLessThan(expected + 10_000);
  };
  near(after.sales - before.sales, 5_000_000);
  near(after.buybacks - before.buybacks, 2_000_000);
  near(after.margin - before.margin, 3_000_000);
  near(after.treasury - before.treasury, 3_000_000);
});

test("le filtre par employé ne garde que ses lignes, page après page", async ({ page }) => {
  const thorald = uniqueName("thorald").toLowerCase();
  const vilkas = uniqueName("vilkas").toLowerCase();
  await createMember(thorald, "mot-de-passe");
  await createMember(vilkas, "mot-de-passe");
  const sales = uniqueName("Vente de Thorald");
  const buyback = uniqueName("Achat de Thorald");
  const other = uniqueName("Vente de Vilkas");
  await createTransactions(thorald, 26, { amount: 2, label: sales });
  await createTransactions(thorald, 1, { amount: 5, label: buyback, kind: "rachat" });
  await createTransactions(vilkas, 3, { amount: 9, label: other });

  await loginAsGerant(page);
  await page.goto("/achat-vente");
  await page.getByLabel("Employé").selectOption({ label: thorald });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/employe=\d+/);
  const table = page.getByTestId("registre");
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await expect(table.locator("tbody tr").filter({ hasNotText: thorald })).toHaveCount(0);
  await expect(page.getByTestId("totaux-registre")).toContainText("+47 septims"); // 26 × 2 − 5

  // The next page keeps the filter.
  const pages = page.getByRole("navigation", { name: "Pages du registre" });
  await expect(pages).toContainText("Page 1 sur 2");
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByLabel("Employé").locator("option:checked")).toHaveText(thorald);

  // It adds up with the other filters.
  await page.getByLabel("Opération").selectOption("rachat");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr")).toContainText(buyback);

  // Another member's filter shows only their lines.
  await page.getByLabel("Opération").selectOption("");
  await page.getByLabel("Employé").selectOption({ label: vilkas });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(table.locator("tbody tr").filter({ hasText: other })).toHaveCount(3);

  await page.getByRole("link", { name: "Tout afficher" }).click();
  await expect(page).toHaveURL(/\/achat-vente$/);
  await expect(page.getByLabel("Employé").locator("option:checked")).toHaveText("Tous");
});

/** One merchandise of a sale or purchase form, by its number. */
function line(form: ReturnType<Page["getByRole"]>, n: number) {
  return form.getByRole("group", { name: `Marchandise ${n}`, exact: true });
}

test("une vente de plusieurs marchandises s'inscrit d'un coup, avec son total en direct", async ({ browser }) => {
  const hide = uniqueName("Peau de chèvre");
  const meat = uniqueName("Viande de chèvre");
  await createProduct(hide, { sellPrice: 3, stock: 10 });
  await createProduct(meat, { sellPrice: 5, stock: 10, category: "viande", unit: "pièce" });
  const { page } = await newEmployeePage(browser, "ysolda");
  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  const total = form.getByTestId("total");
  await expect(total).toHaveText("Total de la vente : 0 septim");
  // The total sits beside "Ajouter une marchandise", above the client's name.
  const add = (await form.getByRole("button", { name: "Ajouter une marchandise" }).boundingBox())!;
  const sum = (await total.boundingBox())!;
  const client = (await form.getByLabel("Nom du client / vendeur RP (facultatif)").boundingBox())!;
  expect(Math.abs(sum.y + sum.height / 2 - (add.y + add.height / 2))).toBeLessThan(4);
  expect(sum.x).toBeGreaterThan(add.x + add.width);
  // Right-aligned, on the right edge of the fields.
  expect(Math.abs(sum.x + sum.width - (client.x + client.width))).toBeLessThan(2);
  expect(sum.y + sum.height).toBeLessThan(client.y);
  // In the comptoir's gold (--gold).
  await expect(total).toHaveCSS("color", "rgb(207, 174, 110)");

  await pickProduct(line(form, 1), hide);
  await line(form, 1).getByLabel("Quantité").fill("2");
  await expect(total).toHaveText("Total de la vente : 6 septims");

  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(line(form, 2), meat);
  await line(form, 2).getByLabel("Quantité").fill("3");
  await expect(total).toHaveText("Total de la vente : 21 septims");

  // A third one, written by hand, then taken back.
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(line(form, 3), "Autre article (hors stock)…");
  await line(form, 3).getByLabel("Nom de l'article").fill("Corne");
  await line(form, 3).getByLabel("Montant (septims)").fill("4");
  await expect(total).toHaveText("Total de la vente : 25 septims");
  await form.getByRole("button", { name: "Retirer la marchandise 3" }).click();
  await expect(line(form, 3)).toHaveCount(0);
  await expect(total).toHaveText("Total de la vente : 21 septims");

  await form.getByLabel("Nom du client / vendeur RP (facultatif)").fill("Ysolda");
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: hide })).toHaveText(
    `Vente inscrite : 2 × ${hide}, 3 × ${meat}, 21 septims au total.`,
  );
  // One register line per merchandise, both with the client, both fresh.
  const fresh = page.getByTestId("registre").locator("tr.fresh");
  await expect(fresh).toHaveCount(2);
  await expect(fresh.filter({ hasText: hide })).toContainText(/Vente.*2.*\+6 septims.*Ysolda/);
  await expect(fresh.filter({ hasText: meat })).toContainText(/Vente.*3.*\+15 septims.*Ysolda/);

  await expect(await stockOf(page, hide)).toHaveText("8");
  await expect(await stockOf(page, meat)).toHaveText("7");
});

test("une marchandise vendue sur deux lignes doit avoir le stock des deux", async ({ browser }) => {
  const product = uniqueName("Peau de sabrecat");
  await createProduct(product, { stock: 3 });
  const { page } = await newEmployeePage(browser, "mjoll");
  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(line(form, 1), product);
  await line(form, 1).getByLabel("Quantité").fill("2");
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(line(form, 2), product);
  await line(form, 2).getByLabel("Quantité").fill("2");
  await expect(form.locator(ALERT)).toHaveText(`Stock insuffisant de ${product} : il ne reste que 3 peaux.`);
  await expect(form.getByRole("button", { name: "Confirmer la vente" })).toBeDisabled();
  await line(form, 2).getByLabel("Quantité").fill("1");
  await expect(form.locator(ALERT)).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Confirmer la vente" })).toBeEnabled();
});

test("une vente de plusieurs marchandises s'inscrit en entier ou pas du tout", async ({ browser }) => {
  const first = uniqueName("Peau de renard");
  const second = uniqueName("Peau de lynx");
  await createProduct(first, { stock: 5 });
  await createProduct(second, { stock: 4 });
  const { page } = await newEmployeePage(browser, "uthgerd");
  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(line(form, 1), first);
  await line(form, 1).getByLabel("Quantité").fill("2");
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(line(form, 2), second);
  await line(form, 2).getByLabel("Quantité").fill("4");

  // Someone else sells the lynx hides meanwhile.
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update products set stock = 1 where name = ${second}`;
  } finally {
    await sql.end();
  }
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(form.locator(ALERT)).toHaveText("Marchandise 2 : Stock insuffisant pour cette vente.");
  // What was typed stays, and the first line was not written either.
  await expect(line(form, 1).getByRole("combobox", { name: "Article ou marchandise" })).toHaveValue(first);
  await expect(await stockOf(page, first)).toHaveText("5");
});

test("une écriture tient en 25 marchandises au plus", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "hroki");
  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  const add = form.getByRole("button", { name: "Ajouter une marchandise" });
  for (let i = 1; i < 25; i++) await add.click();
  await expect(line(form, 25)).toBeVisible();
  await expect(add).toBeDisabled();
  await form.getByRole("button", { name: "Retirer la marchandise 25" }).click();
  await expect(add).toBeEnabled();
});

test("on passe d'un achat à une vente et retour sans rien retaper", async ({ browser }) => {
  const product = uniqueName("Peau de renard");
  await createProduct(product, { buyPrice: 2, sellPrice: 3, stock: 10 });
  const { page } = await newEmployeePage(browser, "brenuin");
  await page.goto("/achat-vente/achat");
  // The button sits right of "Retour au registre".
  const back = (await page.getByRole("link", { name: "Retour au registre" }).boundingBox())!;
  const toSale = page.getByRole("button", { name: "Passer en vente" });
  const switchBox = (await toSale.boundingBox())!;
  expect(Math.abs(switchBox.y - back.y)).toBeLessThan(4);
  expect(switchBox.x).toBeGreaterThan(back.x + back.width);

  const purchase = page.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(line(purchase, 1), product);
  await line(purchase, 1).getByLabel("Quantité").fill("4");
  await expect(line(purchase, 1).getByLabel("Montant (septims)")).toHaveValue("8");
  await purchase.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(line(purchase, 2), "Autre article (hors stock)…");
  await line(purchase, 2).getByLabel("Nom de l'article").fill("Corne");
  await line(purchase, 2).getByLabel("Montant (septims)").fill("5");
  await purchase.getByLabel("Nom du client / vendeur RP (facultatif)").fill("Brenuin");
  await purchase.getByLabel("Notes (facultatif)").fill("Il a hésité");
  await purchase.getByLabel("Je n'ai pas encore pris les septims dans la caisse").check();
  await toSale.click();

  // Same goods, client and notes; the tariff amount follows the sale price, the typed one stays.
  await expect(page.getByRole("heading", { name: "Nouvelle vente", level: 1 })).toBeVisible();
  const sale = page.getByRole("region", { name: "Inscrire une vente" });
  await expect(line(sale, 1).getByRole("combobox", { name: "Article ou marchandise" })).toHaveValue(product);
  await expect(line(sale, 1).getByLabel("Quantité")).toHaveValue("4");
  await expect(line(sale, 1).getByLabel("Montant (septims)")).toHaveValue("12");
  await expect(line(sale, 2).getByRole("combobox", { name: "Article ou marchandise" })).toHaveValue(
    "Autre article (hors stock)…",
  );
  await expect(line(sale, 2).getByLabel("Nom de l'article")).toHaveValue("Corne");
  await expect(line(sale, 2).getByLabel("Montant (septims)")).toHaveValue("5");
  await expect(sale.getByTestId("total")).toHaveText("Total de la vente : 17 septims");
  await expect(sale.getByLabel("Nom du client / vendeur RP (facultatif)")).toHaveValue("Brenuin");
  await expect(sale.getByLabel("Notes (facultatif)")).toHaveValue("Il a hésité");
  await expect(sale.getByLabel("Je n'ai pas encore déposé les septims dans la caisse")).toBeChecked();

  // An amount changed with the pencil comes back as it was typed.
  await line(sale, 1).getByRole("button", { name: "Modifier le montant" }).click();
  await line(sale, 1).getByLabel("Montant (septims)").fill("10");
  await page.getByRole("button", { name: "Passer en achat" }).click();
  await expect(page.getByRole("heading", { name: "Nouvel achat", level: 1 })).toBeVisible();
  const again = page.getByRole("region", { name: "Inscrire un achat" });
  await expect(line(again, 1).getByLabel("Montant (septims)")).toHaveValue("10");
  await expect(line(again, 1).getByRole("button", { name: "Revenir au tarif" })).toBeVisible();
  await again.getByLabel("Je n'ai pas encore pris les septims dans la caisse").uncheck();
  await again.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(page.getByRole("status").filter({ hasText: product })).toHaveText(
    `Achat inscrit : 4 × ${product}, 1 × Corne, 15 septims au total.`,
  );
});
