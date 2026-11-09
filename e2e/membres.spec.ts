import { expect, test } from "@playwright/test";
import { loginAs, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

test("un gérant crée un compte employé, qui peut entrer", async ({ page, browser }) => {
  const username = uniqueName("einar").toLowerCase();
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Membres" }).click();

  const form = page.getByRole("region", { name: "Créer un compte" });
  await form.getByLabel("Identifiant").fill(username);
  await form.getByLabel("Nom affiché (RP)").fill("Einar le Chasseur");
  await form.getByLabel("Mot de passe provisoire").fill("provisoire");
  await form.getByRole("button", { name: "Créer le compte" }).click();
  await expect(form.getByRole("status")).toContainText(`Compte « ${username} » créé`);
  await expect(page.getByTestId(`member-${username}`).locator(".badge")).toHaveText("Employé");

  const employee = await (await browser.newContext()).newPage();
  await loginAs(employee, username, "provisoire");
  await expect(employee.getByTestId("member-name")).toHaveText("Einar le Chasseur");
  await expect(employee.getByRole("link", { name: "Membres" })).toHaveCount(0);
  await employee.goto("/membres");
  await expect(employee).toHaveURL(/\/$/);
});

test("un identifiant déjà pris est refusé", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/membres");
  const form = page.getByRole("region", { name: "Créer un compte" });
  await form.getByLabel("Identifiant").fill("Lomone");
  await form.getByLabel("Nom affiché (RP)").fill("Imposteur");
  await form.getByLabel("Mot de passe provisoire").fill("provisoire");
  await form.getByRole("button", { name: "Créer le compte" }).click();
  await expect(form.locator(ALERT)).toHaveText("Cet identifiant est déjà pris.");
});

test("un compte désactivé est déconnecté et ne peut plus entrer", async ({ page, browser }) => {
  const { page: employee, username } = await newEmployeePage(browser, "intrus");

  await loginAsGerant(page);
  await page.goto("/membres");
  const row = page.getByTestId(`member-${username}`);
  await row.getByLabel("Rôle").selectOption("desactive");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.locator(".badge")).toHaveText("Désactivé");

  await employee.goto("/");
  await expect(employee).toHaveURL(/\/connexion$/);
  await employee.getByLabel("Identifiant").fill(username);
  await employee.getByLabel("Mot de passe").fill("mot-de-passe");
  await employee.getByRole("button", { name: "Entrer au comptoir" }).click();
  await expect(employee.locator(ALERT)).toHaveText("Identifiant ou mot de passe incorrect.");
});

test("un gérant réinitialise un mot de passe oublié", async ({ page, browser }) => {
  const { username } = await newEmployeePage(browser, "sariel");
  await loginAsGerant(page);
  await page.goto("/membres");
  const row = page.getByTestId(`member-${username}`);
  await row.getByLabel("Nouveau mot de passe").fill("tout-neuf-123");
  await row.getByRole("button", { name: "Changer" }).click();
  await expect(row.getByRole("status")).toHaveText("Mot de passe changé.");

  const other = await (await browser.newContext()).newPage();
  await loginAs(other, username, "tout-neuf-123");
});
