import { expect, test, type Page } from "@playwright/test";
import { createProduct, createTransactions, loginAsGerant, memberRow, newEmployeePage, pickProduct, uniqueName } from "./helpers";

/** Writes a sale or a purchase at the tariff through its form, and returns the test id of its register row. */
async function record(page: Page, kind: "vente" | "achat", product: string, quantity: number) {
  await page.goto(`/achat-vente/${kind}`);
  const form = page.getByRole("region", { name: kind === "vente" ? "Inscrire une vente" : "Inscrire un achat" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill(String(quantity));
  await expect(form.getByLabel("Montant (septims)")).not.toHaveValue("");
  await form.getByRole("button", { name: kind === "vente" ? "Confirmer la vente" : "Confirmer l'achat" }).click();
  await expect(page).toHaveURL(/\/achat-vente\?inscrit=\d+$/);
  // Once cancelled, the row is no longer the fresh one: give its line's test id.
  return (await page.getByTestId("registre").locator("tr.fresh").getAttribute("data-testid"))!;
}

/** Opens a member's activity from the Membres page, as a signed-in gérant. */
async function openActivity(page: Page, username: string) {
  await (await memberRow(page, username)).getByRole("link", { name: "Activité" }).click();
  await expect(page).toHaveURL(/\/membres\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: username })).toBeVisible();
}

test("l'activité d'un membre et ses totaux sur les 7 derniers jours", async ({ page, browser }) => {
  // Sold 3 septims and bought 2 septims a unit.
  const product = uniqueName("Peau de loup");
  await createProduct(product, { buyPrice: 2, sellPrice: 3 });
  const reason = uniqueName("Apport");
  // "Aa" sorts the account first, on the first page of Membres.
  const { page: employee, username } = await newEmployeePage(browser, "aa-aela");

  // 10 hides hunted.
  await employee.goto("/inventaire");
  await employee.getByLabel("Rechercher une marchandise").fill(product);
  const card = employee.getByTestId(`stock-${product}`);
  await card.getByRole("button", { name: "Entrée" }).click();
  await card.getByLabel("Quantité entrée").fill("10");
  await card.getByLabel("Motif").fill("chasse");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("10");

  // 5 bought for 10 septims.
  await record(employee, "achat", product, 5);
  // 4 sold at the tariff, 12 septims.
  await record(employee, "vente", product, 4);
  // A sale the gérant cancels counts for nothing, nor does its stock coming
  // back, though another member put it back.
  const cancelled = await record(employee, "vente", product, 2);
  await loginAsGerant(page);
  await page.goto("/achat-vente");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId(cancelled).getByRole("button", { name: /Annuler/ }).click();
  await expect(page.getByTestId(cancelled)).toContainText("Annulée par");
  // 20 septims brought to the till.
  await employee.getByRole("link", { name: /Mouvement de caisse/ }).click();
  const form = employee.getByRole("region", { name: "Inscrire un mouvement de caisse" });
  await form.getByRole("radio", { name: "Entrée d'argent" }).check();
  await form.getByLabel("Montant (septims)").fill("20");
  await form.getByLabel("Motif").fill(reason);
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(employee).toHaveURL(/\/achat-vente\?inscrit=\d+$/);

  await openActivity(page, username);
  // Money paid and cashed; the sale the gérant cancelled is left out.
  await expect(page.getByTestId("total-achats").locator(".stat-value")).toHaveText("−10 septims");
  await expect(page.getByTestId("total-ventes").locator(".stat-value")).toHaveText("+12 septims");
  // Only the hunt: the stock of the purchase and the sales is theirs. 10 hides at 3 septims.
  await expect(page.getByTestId("total-inventaire").locator(".stat-value")).toHaveText("+30 septims");
  await expect(page.getByTestId("total-inventaire")).toContainText("+10 / −0 unités");
  await expect(page.getByTestId("total-caisse").locator(".stat-value")).toHaveText("+20 septims");
  // The default period is the last 7 days, shown in the form.
  await expect(page.getByLabel("Du", { exact: true })).not.toHaveValue("");
  await expect(page.getByLabel("Au", { exact: true })).not.toHaveValue("");

  // Everything they did, in one list: the hunt (stock alone), the purchase,
  // both sales (the cancelled one struck out) and the cash movement. The stock
  // movements of the purchase and the sales are their lines.
  const lines = page.getByTestId("activite").locator("tbody tr");
  await expect(lines).toHaveCount(5);
  await expect(lines.filter({ hasText: "chasse" })).toContainText(/Stock.*\+10.*—/);
  await expect(lines.filter({ hasText: reason })).toContainText(/Caisse.*\+20 septims/);
  await expect(lines.filter({ hasText: "Achat" })).toContainText(/5.*−10 septims/);
  await expect(lines.filter({ hasText: "Annulée par" })).toHaveCount(1);

  // Another period: nothing happened back then.
  await page.getByLabel("Du", { exact: true }).fill("2020-01-01");
  await page.getByLabel("Au", { exact: true }).fill("2020-01-31");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/du=2020-01-01&au=2020-01-31/);
  for (const tile of ["total-achats", "total-ventes", "total-inventaire", "total-caisse"]) {
    await expect(page.getByTestId(tile).locator(".stat-value")).toHaveText("0 septim");
  }
  await expect(page.getByText("Rien sur la période.")).toBeVisible();

  // Back to the last 7 days.
  await page.getByRole("link", { name: "7 derniers jours" }).click();
  await expect(page.getByTestId("total-inventaire").locator(".stat-value")).toHaveText("+30 septims");
});

test("chacun ouvre son activité depuis son nom, un employé ne voit que la sienne", async ({ page, browser }) => {
  const { page: employee, username } = await newEmployeePage(browser, "aa-brand");
  const { page: other, username: otherName } = await newEmployeePage(browser, "aa-brun");

  // The employee's name, top right, opens their own page, without the way back to Membres.
  await employee.getByTestId("member-name").click();
  await expect(employee).toHaveURL(/\/membres\/\d+$/);
  await expect(employee.getByRole("heading", { level: 1, name: username })).toBeVisible();
  await expect(employee.getByText("Mon activité")).toBeVisible();
  await expect(employee.getByRole("link", { name: "Retour aux membres" })).toHaveCount(0);
  const own = employee.url();

  // Another employee's page sends them back to the Grand livre.
  await other.getByTestId("member-name").click();
  await expect(other.getByRole("heading", { level: 1, name: otherName })).toBeVisible();
  await employee.goto(other.url());
  await expect(employee).toHaveURL(/\/$/);
  // Nor can the other one open theirs.
  await other.goto(own);
  await expect(other).toHaveURL(/\/$/);

  // A gérant opens their own from their name, and any member's from Membres.
  await loginAsGerant(page);
  await page.getByTestId("member-name").click();
  await expect(page).toHaveURL(/\/membres\/\d+$/);
  await expect(page.getByText("Mon activité")).toBeVisible();
  await openActivity(page, username);
  expect(page.url()).toBe(own);
  await expect(page.getByText("Activité d'un membre")).toBeVisible();

  // An id no member can have is a missing page, not a server error.
  for (const id of ["0", "abc", "99999999999"]) {
    await page.goto(`/membres/${id}`);
    // The page streams behind its loading screen, so the status stays 200: read the screen.
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }
});

test("l'activité d'un membre est paginée", async ({ page, browser }) => {
  const { username } = await newEmployeePage(browser, "aa-cora");
  // 26 sales yesterday: one more than a page.
  await createTransactions(username, 26, { label: "Vente paginée" });
  await loginAsGerant(page);
  await openActivity(page, username);
  const lines = page.getByTestId("activite").locator("tbody tr");
  await expect(lines).toHaveCount(25);
  const pages = page.getByRole("navigation", { name: "Pages de l'activité" });
  await expect(pages).toContainText("Page 1 sur 2 · 26 opérations");
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(lines).toHaveCount(1);
});
