import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("un visiteur non connecté arrive sur la page de connexion", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole("heading", { name: /Comptoir\s*de Chasse/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Entrer au comptoir avec Discord" })).toBeVisible();
});

test("un gérant entre au comptoir et peut se déconnecter", async ({ page }) => {
  await loginAs(page, "Lomone");

  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
  await expect(page.getByTestId("member-name")).toHaveText("Lomone");
  await expect(page.getByRole("link", { name: "Membres" })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);
});
