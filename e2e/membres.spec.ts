import { expect, test } from "@playwright/test";
import { loginAs, newMemberPage, uniqueName } from "./helpers";

test("un nouveau venu attend la validation d'un gérant", async ({ page, browser }) => {
  const discordName = uniqueName("Einar");
  const newcomer = await newMemberPage(browser, discordName);
  await expect(newcomer.getByRole("heading", { name: "En attente" })).toBeVisible();
  await newcomer.goto("/");
  await expect(newcomer).toHaveURL(/\/attente$/);

  await loginAs(page, "Lomone");
  await page.getByRole("link", { name: "Membres" }).click();
  await expect(page.getByRole("status")).toContainText(/attendent? ta validation/);
  const row = page.getByTestId(`member-${discordName}`);
  await row.getByLabel("Nom affiché").fill("Einar le Chasseur");
  await row.getByLabel("Rôle").selectOption("employe");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.locator(".badge", { hasText: "Employé" })).toBeVisible();

  await newcomer.goto("/");
  await expect(newcomer.getByRole("heading", { name: "Grand livre" })).toBeVisible();
  await expect(newcomer.getByTestId("member-name")).toHaveText("Einar le Chasseur");
  await expect(newcomer.getByRole("link", { name: "Membres" })).toHaveCount(0);

  await newcomer.goto("/membres");
  await expect(newcomer).toHaveURL(/\/$/);
});

test("un gérant refuse un accès", async ({ page, browser }) => {
  const discordName = uniqueName("Intrus");
  const intruder = await newMemberPage(browser, discordName);

  await loginAs(page, "Lomone");
  await page.goto("/membres");
  const row = page.getByTestId(`member-${discordName}`);
  await row.getByLabel("Rôle").selectOption("refuse");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.locator(".badge", { hasText: "Refusé" })).toBeVisible();

  await intruder.goto("/");
  await expect(intruder.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
});
