import { expect, test } from "@playwright/test";

test("la page d'accueil souhaite la bienvenue", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Comptoir des chasseurs");
  await expect(
    page.getByRole("heading", { level: 1, name: "Comptoir des chasseurs" }),
  ).toBeVisible();
  await expect(
    page.getByText("Bienvenue au comptoir des chasseurs de Vendeaume !"),
  ).toBeVisible();
});
