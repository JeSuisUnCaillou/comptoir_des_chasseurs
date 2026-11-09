import { expect, test, type Page } from "@playwright/test";
import { createProduct, createTransactions, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

async function record(
  page: Page,
  kind: "vente" | "rachat",
  { product, quantity, counterparty }: { product: string; quantity: number; counterparty?: string },
) {
  await page.goto(`/achat-vente?saisie=${kind}`);
  const form = page.getByRole("region", { name: kind === "vente" ? "Inscrire une vente" : "Inscrire un rachat" });
  await form.getByLabel("Article ou marchandise").selectOption({ label: product });
  await form.getByLabel("Quantité").fill(String(quantity));
  await form.getByRole("button", { name: "Appliquer le tarif" }).click();
  if (counterparty) await form.getByLabel("Nom du client / vendeur RP (facultatif)").fill(counterparty);
  await form.getByRole("button", { name: kind === "vente" ? "Confirmer la vente" : "Confirmer le rachat" }).click();
  await expect(form.getByRole("status")).toContainText(`${quantity} × ${product}`);
  return form;
}

async function stockOf(page: Page, product: string) {
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(product);
  return page.getByTestId(`stock-${product}`).getByTestId("stock-value");
}

test("un rachat puis une vente mettent à jour le stock et le registre", async ({ browser }) => {
  const product = uniqueName("Peau de dragon");
  await createProduct(product, { buyPrice: 2, sellPrice: 3 });
  const { page } = await newEmployeePage(browser, "brelyna");

  const buy = await record(page, "rachat", { product, quantity: 10, counterparty: "Aela" });
  await expect(buy.getByRole("status")).toContainText("20 septims");
  const sell = await record(page, "vente", { product, quantity: 4, counterparty: "Belethor" });
  await expect(sell.getByRole("status")).toContainText("12 septims");
  // The form is ready for the next line.
  await expect(sell.getByLabel("Quantité")).toHaveValue("1");

  await expect(await stockOf(page, product)).toHaveText("6");

  await page.getByRole("link", { name: "Achat / Vente" }).click();
  const rows = page.getByTestId("registre").getByRole("row").filter({ hasText: product });
  await expect(rows.filter({ hasText: "Belethor" })).toContainText(/Vente.*4.*\+12 septims/);
  await expect(rows.filter({ hasText: "Aela" })).toContainText(/Rachat.*10.*−20 septims/);

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
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await form.getByLabel("Article ou marchandise").selectOption("autre");
  await form.getByLabel("Nom de l'article").fill(label);
  await form.getByLabel("Montant total (septims)").fill("500");
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(form.getByRole("status")).toContainText(`1 × ${label}, 500 septims`);
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
