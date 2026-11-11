import { expect, test } from "@playwright/test";
import { createMember, loginAs, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

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
  const { page: employee, username } = await newEmployeePage(browser, "sariel");
  await loginAsGerant(page);
  await page.goto("/membres");
  const row = page.getByTestId(`member-${username}`);
  await row.getByLabel("Nouveau mot de passe").fill("tout-neuf-123");
  await row.getByRole("button", { name: "Changer" }).click();
  await expect(row.getByRole("status")).toHaveText("Mot de passe changé.");

  // Whoever was using the old password is signed out.
  await employee.goto("/");
  await expect(employee).toHaveURL(/\/connexion$/);

  const other = await (await browser.newContext()).newPage();
  await loginAs(other, username, "tout-neuf-123");
});

test("la liste des comptes est paginée", async ({ page }) => {
  // 26 accounts, enough for a second page whatever the other tests create.
  // "Zz" sorts them after everyone, so they never push another test's member
  // off the first page.
  const tag = uniqueName("zz-page");
  for (let i = 1; i <= 26; i++) {
    const n = String(i).padStart(2, "0");
    await createMember(`${tag}-${n}`, "mot-de-passe", "employe", `Zz ${tag} ${n}`);
  }
  const last = page.getByTestId(`member-${tag}-26`);
  await loginAsGerant(page);
  await page.goto("/membres");
  const pages = page.getByRole("navigation", { name: "Pages des comptes" });
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(pages).toContainText(/Page 1 sur \d+/);
  // The 26th of the group sorts after 25 others: it cannot be on the first page.
  await expect(last).toHaveCount(0);

  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pages).toContainText(/Page 2 sur \d+/);
  // It sorts last of all, so it is on the last page.
  const next = pages.getByRole("link", { name: "Suivant" });
  for (let n = 3; await next.count(); n++) {
    await next.click();
    await expect(pages).toContainText(`Page ${n} sur`);
  }
  await expect(last).toBeVisible();
});

test("un gérant nomme un employé gérant, qui gère alors les comptes", async ({ page, browser }) => {
  // "Aa" sorts them first, so they stay on the first page of the accounts.
  const { page: employee, username } = await newEmployeePage(browser, "aa-brina");
  await expect(employee.getByRole("link", { name: "Membres" })).toHaveCount(0);

  await loginAsGerant(page);
  await page.goto("/membres");
  const row = page.getByTestId(`member-${username}`);
  await row.getByLabel("Nom affiché").fill("Aa Brina Merilis");
  await row.getByLabel("Rôle").selectOption("gerant");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.locator(".badge")).toHaveText("Gérant");

  await employee.reload();
  await expect(employee.getByTestId("member-name")).toHaveText("Aa Brina Merilis");
  await employee.getByRole("link", { name: "Membres" }).click();
  await expect(employee.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
});

test("un gérant ne peut pas se retirer son propre rôle de gérant", async ({ browser }) => {
  // "Aa" sorts them first, so they stay on the first page of the accounts.
  const username = uniqueName("aa-vignar").toLowerCase();
  await createMember(username, "mot-de-passe", "gerant", "Aa Vignar");
  const page = await (await browser.newContext()).newPage();
  await loginAs(page, username, "mot-de-passe");
  await page.goto("/membres");
  const row = page.getByTestId(`member-${username}`);
  // No role to pick on their own row, only the name.
  await expect(row.getByLabel("Rôle")).toHaveCount(0);
  await row.getByLabel("Nom affiché").fill("Aa Vignar Grisecrinière");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("member-name")).toHaveText("Aa Vignar Grisecrinière");
  await expect(row.locator(".badge")).toHaveText("Gérant");
});
