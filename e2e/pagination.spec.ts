import { expect, test } from "@playwright/test";
import { createProduct, loginAsGerant, uniqueName } from "./helpers";

test("les cartes du stock sont paginées, et une recherche revient à la première page", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/inventaire");
  const pages = page.getByRole("navigation", { name: "Pages du stock" });
  const cards = page.locator(".stock-card");
  await expect(cards).toHaveCount(24);
  await expect(pages).toContainText(/Page 1 sur \d+/);
  await pages.getByRole("button", { name: "Suivant" }).click();
  await expect(pages).toContainText(/Page 2 sur \d+/);

  await page.getByLabel("Rechercher une marchandise").fill("Biche");
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId("stock-Biche")).toBeVisible();
  await expect(pages).toHaveCount(0);
});

test("le catalogue des marchandises se cherche et se pagine", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/marchandises");
  const pages = page.getByRole("navigation", { name: "Pages des marchandises" });
  await expect(page.getByRole("link", { name: /^Modifier / })).toHaveCount(25);
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pages).toContainText(/Page 2 sur \d+/);

  const search = page.getByRole("searchbox", { name: "Chercher une marchandise" });
  // The search filters as you type, with no button, and goes back to page 1.
  await expect(page.getByRole("button", { name: "Chercher" })).toHaveCount(0);
  await search.pressSequentially("ours");
  await expect(page).toHaveURL(/\/marchandises\?q=ours$/);
  await expect(page.getByRole("link", { name: /^Modifier / })).toHaveCount(3); // Ours, des neiges, troglodyte
  await search.fill("introuvable-xyz");
  await expect(page.getByText("Aucune marchandise ne correspond.")).toBeVisible();
  await search.clear();
  await expect(page).toHaveURL(/\/marchandises$/);
  await expect(page.getByRole("link", { name: /^Modifier / })).toHaveCount(25);
});

test("l'historique du stock est paginé", async ({ page }) => {
  const product = uniqueName("Peau de vasard");
  await createProduct(product);
  await loginAsGerant(page);
  // 26 movements, enough for a second page whatever the other tests do.
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(product);
  const card = page.getByTestId(`stock-${product}`);
  for (let i = 0; i < 26; i++) {
    await card.getByRole("button", { name: "Entrée" }).click();
    await card.getByLabel("Quantité ajoutée").fill("1");
    await card.getByLabel("Motif").fill(`pagination ${i}`);
    await card.getByRole("button", { name: "Valider" }).click();
    await expect(card.getByRole("button", { name: "Entrée" })).toBeVisible();
  }
  const pages = page.getByRole("navigation", { name: "Pages de l'historique" });
  await expect(page.getByTestId("historique").locator("tbody tr")).toHaveCount(25);
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pages).toContainText(/Page 2 sur \d+/);
});
