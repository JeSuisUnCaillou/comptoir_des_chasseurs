import { expect, test, type Page } from "@playwright/test";
import { createProduct, loginAsGerant, newEmployeePage, pickProduct, uniqueName } from "./helpers";

/** Writes a sale or a purchase at the tariff through its form, and returns its register row. */
async function record(page: Page, kind: "vente" | "achat", product: string, quantity: number) {
  await page.goto(`/achat-vente/${kind}`);
  const form = page.getByRole("region", { name: kind === "vente" ? "Inscrire une vente" : "Inscrire un achat" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill(String(quantity));
  await expect(form.getByLabel("Montant (septims)")).not.toHaveValue("");
  await form.getByRole("button", { name: kind === "vente" ? "Confirmer la vente" : "Confirmer l'achat" }).click();
  await expect(page).toHaveURL(/\/achat-vente\?inscrit=\d+$/);
  // Once cancelled, the row is no longer the fresh one: find it by its line number.
  const id = await page.getByTestId("registre").locator("tr.fresh").getAttribute("data-testid");
  return page.getByTestId(id!);
}

/** Opens a member's activity from the Membres page, as a gérant. */
async function openActivity(page: Page, username: string) {
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Membres" }).click();
  await page.getByTestId(`member-${username}`).getByRole("link", { name: "Activité" }).click();
  await expect(page).toHaveURL(/\/membres\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name: username })).toBeVisible();
}

test("l'activité d'un membre et la valeur qu'il a apportée sur les 7 derniers jours", async ({ page, browser }) => {
  // Sold 3 septims and bought 2 septims a unit.
  const product = uniqueName("Peau de loup");
  await createProduct(product, { buyPrice: 2, sellPrice: 3 });
  const reason = uniqueName("Apport");
  // "Aa" sorts the account first, on the first page of Membres.
  const { page: employee, username } = await newEmployeePage(browser, "aa-aela");

  // 10 hides hunted: +30 septims of stock.
  await employee.goto("/inventaire");
  await employee.getByLabel("Rechercher une marchandise").fill(product);
  const card = employee.getByTestId(`stock-${product}`);
  await card.getByRole("button", { name: "Entrée" }).click();
  await card.getByLabel("Quantité entrée").fill("10");
  await card.getByLabel("Motif").fill("chasse");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("10");

  // 5 bought for 10 septims, which sell for 15: +5.
  await record(employee, "achat", product, 5);
  // 4 sold at the tariff: the till gets what the stock loses, 0.
  await record(employee, "vente", product, 4);
  // A sale cancelled counts for nothing, nor does its stock coming back.
  const cancelled = await record(employee, "vente", product, 2);
  employee.once("dialog", (dialog) => dialog.accept());
  await cancelled.getByRole("button", { name: /Annuler/ }).click();
  await expect(cancelled).toContainText("Annulée par");
  // 20 septims brought to the till: +20.
  await employee.getByRole("link", { name: /Mouvement de caisse/ }).click();
  const form = employee.getByRole("region", { name: "Inscrire un mouvement de caisse" });
  await form.getByRole("radio", { name: "Entrée d'argent" }).check();
  await form.getByLabel("Montant (septims)").fill("20");
  await form.getByLabel("Motif").fill(reason);
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(employee).toHaveURL(/\/achat-vente\?inscrit=\d+$/);

  await openActivity(page, username);
  await expect(page.getByTestId("valeur-apportee")).toContainText("+55 septims");
  await expect(page.getByTestId("valeur-inventaire")).toContainText("+30 septims");
  await expect(page.getByTestId("valeur-achats")).toContainText("+5 septims");
  await expect(page.getByTestId("valeur-ventes").locator(".stat-value")).toHaveText("0 septim");
  await expect(page.getByTestId("valeur-caisse")).toContainText("+20 septims");
  // The default period is the last 7 days, shown in the form.
  await expect(page.getByLabel("Du", { exact: true })).not.toHaveValue("");
  await expect(page.getByLabel("Au", { exact: true })).not.toHaveValue("");

  // Everything they wrote, cancelled lines included, and every stock movement.
  const register = page.getByTestId("registre");
  await expect(register.getByRole("row")).toHaveCount(5);
  await expect(register.getByRole("row").filter({ hasText: reason })).toContainText("+20 septims");
  await expect(register.getByRole("row").filter({ hasText: "Annulée" })).toHaveCount(1);
  const movements = page.getByTestId("historique");
  await expect(movements.getByRole("row").filter({ hasText: "chasse" })).toContainText("+10");
  // Hunt, purchase, two sales and the cancellation, plus the header.
  await expect(movements.getByRole("row")).toHaveCount(6);

  // Another period: nothing happened back then.
  await page.getByLabel("Du", { exact: true }).fill("2020-01-01");
  await page.getByLabel("Au", { exact: true }).fill("2020-01-31");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/du=2020-01-01&au=2020-01-31/);
  await expect(page.getByTestId("valeur-apportee").locator(".stat-value")).toHaveText("0 septim");
  await expect(page.getByText("Aucune écriture sur la période.")).toBeVisible();
  await expect(page.getByText("Aucun mouvement sur la période.")).toBeVisible();

  // Back to the last 7 days.
  await page.getByRole("link", { name: "7 derniers jours" }).click();
  await expect(page.getByTestId("valeur-apportee")).toContainText("+55 septims");
});

test("seul un gérant voit l'activité d'un membre", async ({ page, browser }) => {
  const { page: employee, username } = await newEmployeePage(browser, "aa-brand");
  await openActivity(page, username);
  const url = page.url();
  await employee.goto(url);
  await expect(employee).toHaveURL(/\/$/);

  // An id no member can have is a missing page, not a server error.
  for (const id of ["0", "abc", "99999999999"]) {
    await page.goto(`/membres/${id}`);
    // The page streams behind its loading screen, so the status stays 200: read the screen.
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }
});
