import { expect, test, type Page } from "@playwright/test";
import { createProduct, createTransactions, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

/** Writes a line through its form; the form then brings the member back to the register. */
async function record(
  page: Page,
  kind: "vente" | "achat",
  { product, quantity, counterparty }: { product: string; quantity: number; counterparty?: string },
) {
  await page.goto(`/achat-vente/${kind}`);
  const form = page.getByRole("region", { name: kind === "vente" ? "Inscrire une vente" : "Inscrire un achat" });
  await form.getByLabel("Article ou marchandise").selectOption({ label: product });
  await form.getByLabel("Quantité").fill(String(quantity));
  // The tariff fills the amount on its own.
  await expect(form.getByLabel("Montant total (septims)")).not.toHaveValue("");
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
  await form.getByLabel("Article ou marchandise").selectOption({ label: product });
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
  await form.getByLabel("Article ou marchandise").selectOption("autre");
  await form.getByLabel("Nom de l'article").fill(label);
  await form.getByLabel("Montant total (septims)").fill("500");
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: label })).toHaveText(
    `Vente inscrite : 1 × ${label}, 500 septims.`,
  );
  await expect(
    page.getByTestId("registre").getByRole("row").filter({ hasText: label }),
  ).toContainText("+500 septims");
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

test("le grand livre montre la caisse et les dernières écritures", async ({ browser }) => {
  const product = uniqueName("Peau de mammouth");
  await createProduct(product, { buyPrice: 5, sellPrice: 8, stock: 3 });
  const { page } = await newEmployeePage(browser, "faralda");
  await record(page, "vente", { product, quantity: 2 });

  await page.getByRole("link", { name: "Grand livre" }).click();
  await expect(page.getByTestId("caisse-jour")).toContainText("Aujourd'hui");
  await expect(page.getByTestId("caisse-jour")).toContainText(/septims? encaissés/);
  await expect(page.getByTestId("caisse-totale")).toBeVisible();
  await expect(page.getByTestId("registre").getByRole("row").filter({ hasText: product })).toContainText(
    "+16 septims",
  );
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
  const amount = form.getByLabel("Montant total (septims)");
  await form.getByLabel("Article ou marchandise").selectOption({ label: product });
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
  // Amounts far above what other tests write, so their lines cannot blur the deltas.
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
  expect(after.week - before.week).toBeGreaterThanOrEqual(100_000); // 4 days ago is in the week
  expect(after.week - before.week).toBeLessThan(1_000_000); // 8 days ago is not
  expect(after.all - before.all).toBeGreaterThanOrEqual(1_100_000);
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
