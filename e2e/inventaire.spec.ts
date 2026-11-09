import { expect, test, type Page } from "@playwright/test";
import { loginAsGerant, uniqueName } from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

async function addProduct(page: Page, name: string) {
  await page.goto("/marchandises");
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill(name);
  await form.getByLabel("Catégorie").selectOption("peau");
  await form.getByLabel("Unité (au singulier)").fill("peau");
  await page.getByRole("button", { name: "Ajouter la marchandise" }).click();
  await expect(async () => {
    await page.goto(`/marchandises?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("link", { name: `Modifier ${name}` })).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test("entrées et sorties de stock, avec historique", async ({ page }) => {
  const name = uniqueName("Troll");
  await loginAsGerant(page);
  await addProduct(page, name);

  await page.getByRole("link", { name: "Inventaire" }).click();
  await page.getByLabel("Rechercher une marchandise").fill(name);
  const card = page.getByTestId(`stock-${name}`);
  await expect(card).toContainText("Rupture");
  await expect(card.getByRole("button", { name: "Sortie" })).toBeDisabled();

  await card.getByRole("button", { name: "Entrée" }).click();
  await card.getByLabel("Quantité entrée").fill("10");
  await card.getByLabel("Motif").fill("chasse du matin");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("10");
  await expect(card).toContainText("En stock");

  await card.getByRole("button", { name: "Sortie" }).click();
  await card.getByLabel("Quantité sortie").fill("4");
  await card.getByLabel("Motif").fill("transformation en cuir");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("6");

  const history = page.getByTestId("historique");
  const rows = history.getByRole("row").filter({ hasText: name });
  await expect(rows.filter({ hasText: "transformation en cuir" })).toContainText(
    /−4.*6 peaux.*Lomone/,
  );
  await expect(rows.filter({ hasText: "chasse du matin" })).toContainText("+10");
});

test("une sortie ne peut pas dépasser le stock", async ({ page }) => {
  const name = uniqueName("Mammouth");
  await loginAsGerant(page);
  await addProduct(page, name);
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(name);
  const card = page.getByTestId(`stock-${name}`);

  await card.getByRole("button", { name: "Entrée" }).click();
  await card.getByLabel("Quantité entrée").fill("2");
  await card.getByLabel("Motif").fill("arrivage");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("2");

  // Skip the browser's max check to hit the server-side guard.
  await card.getByRole("button", { name: "Sortie" }).click();
  await card.getByLabel("Quantité sortie").evaluate((el) => el.removeAttribute("max"));
  await card.getByLabel("Quantité sortie").fill("5");
  await card.getByLabel("Motif").fill("trop");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.locator(ALERT)).toHaveText("Stock insuffisant pour cette sortie.");
  await page.reload();
  await page.getByLabel("Rechercher une marchandise").fill(name);
  await expect(card.getByTestId("stock-value")).toHaveText("2");
});
