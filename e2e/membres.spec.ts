import { expect, test } from "@playwright/test";
import {
  ALERT,
  createMember,
  loginAs,
  loginAsGerant,
  makeSuperAdmin,
  memberRow,
  newEmployeePage,
  setRole,
  uniqueName,
} from "./helpers";

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
  await expect((await memberRow(page, username)).locator(".badge")).toHaveText("Employé");

  const employee = await (await browser.newContext()).newPage();
  await loginAs(employee, username, "provisoire");
  await expect(employee.getByTestId("member-name")).toHaveText("Einar le Chasseur");
  await expect(employee.getByRole("link", { name: "Membres" })).toHaveCount(0);
  await employee.goto("/membres");
  await expect(employee).toHaveURL(/\/le-comptoir-des-chasseurs$/);
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
  const row = await memberRow(page, username);
  // The role selector no longer deactivates: it has its own button.
  await expect(row.getByLabel("Rôle").locator("option")).toHaveText(["Gérant", "Employé"]);
  await row.getByRole("button", { name: /^Désactiver/ }).click();
  // Its row moves to the end of the list, maybe to another page.
  await expect(row.getByRole("button", { name: /^Désactiver/ })).toHaveCount(0);
  const moved = await memberRow(page, username);
  await expect(moved.locator(".badge")).toHaveText("Désactivé");
  await expect(moved.getByLabel("Rôle")).toHaveCount(0);

  await employee.goto("/");
  await expect(employee).toHaveURL(/\/connexion$/);
  await employee.getByLabel("Identifiant").fill(username);
  await employee.getByLabel("Mot de passe").fill("mot-de-passe");
  await employee.getByRole("button", { name: "Se connecter" }).click();
  await expect(employee.locator(ALERT)).toHaveText("Identifiant ou mot de passe incorrect.");
});

test("un gérant réinitialise un mot de passe oublié", async ({ page, browser }) => {
  const { page: employee, username } = await newEmployeePage(browser, "sariel");
  await loginAsGerant(page);
  const row = await memberRow(page, username);
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
  const { page: employee, username } = await newEmployeePage(browser, "brina");
  await expect(employee.getByRole("link", { name: "Membres" })).toHaveCount(0);

  await loginAsGerant(page);
  const row = await memberRow(page, username);
  // The new name sorts right after the old one: the row stays on its page.
  await row.getByLabel("Nom affiché").fill(`${username} Merilis`);
  await row.getByLabel("Rôle").selectOption("gerant");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.locator(".badge")).toHaveText("Gérant");

  await employee.reload();
  await expect(employee.getByTestId("member-name")).toHaveText(`${username} Merilis`);
  await employee.getByRole("link", { name: "Membres" }).click();
  await expect(employee.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
});

test("un gérant ne peut pas se retirer son propre rôle de gérant", async ({ browser }) => {
  const username = uniqueName("vignar").toLowerCase();
  await createMember(username, "mot-de-passe", "gerant");
  const page = await (await browser.newContext()).newPage();
  await loginAs(page, username, "mot-de-passe");
  const row = await memberRow(page, username);
  // No role to pick on their own row, only the name.
  await expect(row.getByLabel("Rôle")).toHaveCount(0);
  await row.getByLabel("Nom affiché").fill(`${username} Grisecrinière`);
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByTestId("member-name")).toHaveText(`${username} Grisecrinière`);
  await expect(row.locator(".badge")).toHaveText("Gérant");
});

test("personne d'autre que le super admin ne touche à son compte", async ({ page, browser }) => {
  // "Aa" sorts both accounts on the first page of Membres.
  const boss = uniqueName("aa-boss").toLowerCase();
  const other = uniqueName("aa-gerant").toLowerCase();
  await createMember(boss, "mot-de-passe", "gerant", `Aa ${boss}`);
  await createMember(other, "mot-de-passe", "gerant", `Aa ${other}`);
  await makeSuperAdmin(boss);

  await loginAs(page, other, "mot-de-passe");
  await page.goto("/membres");
  const row = page.getByTestId(`member-${boss}`);
  await expect(row.getByText("Super admin")).toBeVisible();
  await expect(row.getByLabel("Rôle")).toHaveCount(0);
  await expect(row.getByLabel("Nom affiché")).toHaveCount(0);
  await expect(row.getByLabel("Nouveau mot de passe")).toHaveCount(0);

  // The super admin still runs the comptoir, and edits their own name.
  const owner = await (await browser.newContext()).newPage();
  await loginAs(owner, boss, "mot-de-passe");
  await owner.goto("/membres");
  const own = owner.getByTestId(`member-${boss}`);
  await expect(own.getByLabel("Rôle")).toHaveCount(0);
  await own.getByLabel("Nom affiché").fill(`Aa ${boss} le Patron`);
  await own.getByRole("button", { name: "Enregistrer" }).click();
  await expect(owner.getByTestId("member-name")).toHaveText(`Aa ${boss} le Patron`);
  const theirs = owner.getByTestId(`member-${other}`);
  await theirs.getByLabel("Rôle").selectOption("employe");
  await theirs.getByRole("button", { name: "Enregistrer" }).click();
  await expect(theirs.locator(".badge")).toHaveText("Employé");
});

test("le serveur refuse de modifier le super admin, même par un formulaire ouvert avant", async ({ page, browser }) => {
  const boss = uniqueName("aa-chef").toLowerCase();
  const other = uniqueName("aa-second").toLowerCase();
  await createMember(boss, "mot-de-passe", "gerant", `Aa ${boss}`);
  await createMember(other, "mot-de-passe", "gerant", `Aa ${other}`);

  // The forms are on screen while the account is still an ordinary gérant.
  await loginAs(page, other, "mot-de-passe");
  await page.goto("/membres");
  const row = page.getByTestId(`member-${boss}`);
  await expect(row.getByLabel("Rôle")).toBeVisible();
  await makeSuperAdmin(boss);

  await row.getByLabel("Nouveau mot de passe").fill("vole-le-compte");
  await row.getByRole("button", { name: "Changer" }).click();
  await expect(row.locator(ALERT)).toHaveText("Tu ne peux pas modifier ce compte.");

  await row.getByRole("button", { name: /^Désactiver/ }).click();
  await expect(row.locator(ALERT)).toHaveText("Tu ne peux pas modifier ce compte.");
  await row.getByLabel("Rôle").selectOption("employe");
  await row.getByRole("button", { name: "Enregistrer" }).click();
  await expect(row.getByText("Super admin")).toBeVisible();
  await expect(row.getByLabel("Rôle")).toHaveCount(0);
  await expect(row.locator(".badge").first()).toHaveText("Gérant");

  // Still a gérant, with the old password.
  const owner = await (await browser.newContext()).newPage();
  await loginAs(owner, boss, "mot-de-passe");
  await expect(owner.getByRole("link", { name: "Membres" })).toBeVisible();
});

test("un compte désactivé passe en fin de liste, et « Réactiver » le rend employé", async ({ page, browser }) => {
  // "0" sorts the account first while it is active.
  const username = uniqueName("0-ulfric").toLowerCase();
  await createMember(username, "mot-de-passe", "gerant", `0 ${username}`);
  await loginAsGerant(page);
  await page.goto("/membres");
  const row = page.getByTestId(`member-${username}`);
  await row.getByRole("button", { name: /^Désactiver/ }).click();
  await expect(row.getByRole("button", { name: /^Désactiver/ })).toHaveCount(0);

  // On its page, only deactivated accounts come after it.
  const moved = await memberRow(page, username);
  const badges = await page.locator("tbody tr").evaluateAll((rows, id) => {
    const statuses = rows.map((tr) => tr.querySelector(".badge")?.textContent ?? "");
    const at = rows.findIndex((tr) => tr.getAttribute("data-testid") === id);
    return statuses.slice(at);
  }, `member-${username}`);
  expect(badges.every((b) => b === "Désactivé")).toBe(true);

  await moved.getByRole("button", { name: /^Réactiver/ }).click();
  await expect(moved.getByRole("button", { name: /^Réactiver/ })).toHaveCount(0);
  await page.goto("/membres");
  await expect(row.locator(".badge")).toHaveText("Employé");

  const back = await (await browser.newContext()).newPage();
  await loginAs(back, username, "mot-de-passe");
  await expect(back.getByTestId("member-name")).toHaveText(`0 ${username}`);
  await expect(back.getByRole("link", { name: "Membres" })).toHaveCount(0);
});

test("le serveur refuse de désactiver à qui n'est plus gérant, même par une page ouverte avant", async ({ page }) => {
  const boss = uniqueName("0-brunwulf").toLowerCase();
  const target = uniqueName("0-irileth").toLowerCase();
  await createMember(boss, "mot-de-passe", "gerant", `0 ${boss}`);
  await createMember(target, "mot-de-passe", "employe", `0 ${target}`);

  await loginAs(page, boss, "mot-de-passe");
  await page.goto("/membres");
  const row = page.getByTestId(`member-${target}`);
  await expect(row.getByRole("button", { name: /^Désactiver/ })).toBeVisible();
  await setRole(boss, "employe");
  await row.getByRole("button", { name: /^Désactiver/ }).click();
  await expect(page).not.toHaveURL(/\/membres/);

  const gerant = await (await page.context().browser()!.newContext()).newPage();
  await loginAsGerant(gerant);
  await expect((await memberRow(gerant, target)).locator(".badge")).toHaveText("Employé");
});

test("le bouton « Activité » garde sa largeur à côté de « Désactiver »", async ({ page }) => {
  const username = uniqueName("0-ralof").toLowerCase();
  await createMember(username, "mot-de-passe", "employe", `0 ${username}`);
  await loginAsGerant(page);
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/membres");
    const row = page.getByTestId(`member-${username}`);
    const activity = await row.getByRole("link", { name: "Activité" }).boundingBox();
    const deactivate = await row.getByRole("button", { name: /^Désactiver/ }).boundingBox();
    // Side by side on one line, not a full-width button above the other.
    expect(activity!.width).toBeLessThan(150);
    expect(Math.abs(activity!.y - deactivate!.y)).toBeLessThan(4);
  }
});
