import { expect, test } from "@playwright/test";
import { ALERT, GERANT, createMember, loginAs, loginAsGerant, uniqueName } from "./helpers";

test("un visiteur non connecté arrive sur la page de connexion", async ({ page }) => {
  await page.goto("/inventaire");

  // The comptoir's old address leads to its page in the shop.
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fle-comptoir-des-chasseurs%2Finventaire$/);
  await expect(page.getByRole("heading", { name: /Comptoir\s*des chasseurs/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrer au comptoir" })).toBeVisible();
});

test("après connexion, le membre revient sur la page qu'il avait ouverte, avec ses filtres", async ({
  page,
}) => {
  await page.goto("/achat-vente?type=vente");
  await expect(page).toHaveURL(/\/connexion\?suite=/);

  await page.getByLabel("Identifiant").fill(GERANT.username);
  await page.getByLabel("Mot de passe").fill(GERANT.password);
  await page.getByRole("button", { name: "Entrer au comptoir" }).click();

  await expect(page).toHaveURL(/\/achat-vente\?type=vente$/);
  await expect(page.getByRole("heading", { name: "Achat / Vente" })).toBeVisible();
});

test("un mauvais mot de passe garde la page à rejoindre", async ({ page }) => {
  await page.goto("/inventaire");
  await page.getByLabel("Identifiant").fill(GERANT.username);
  await page.getByLabel("Mot de passe").fill("pas-le-bon");
  await page.getByRole("button", { name: "Entrer au comptoir" }).click();
  await expect(page.locator(ALERT)).toHaveText("Identifiant ou mot de passe incorrect.");

  await page.getByLabel("Mot de passe").fill(GERANT.password);
  await page.getByRole("button", { name: "Entrer au comptoir" }).click();
  await expect(page).toHaveURL(/\/inventaire$/);
});

for (const suite of ["//example.com", "https://example.com/", "/\\example.com", "/.//example.com", "/a/..//example.com"]) {
  test(`un lien de connexion vers un autre site (${suite}) ramène à ses boutiques`, async ({
    page,
  }) => {
    await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
    await page.getByLabel("Identifiant").fill(GERANT.username);
    await page.getByLabel("Mot de passe").fill(GERANT.password);
    await page.getByRole("button", { name: "Entrer au comptoir" }).click();

    // The super admin's own shops: the comptoir, or the choice of shops when tests made others.
    const home = /^http:\/\/localhost:\d+\/(le-comptoir-des-chasseurs|boutiques)$/;
    await expect(page).toHaveURL(home);

    // Already signed in, the same link redirects straight away.
    await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
    await expect(page).toHaveURL(home);
  });
}

test("un mauvais mot de passe est refusé", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(GERANT.username);
  await page.getByLabel("Mot de passe").fill("pas-le-bon");
  await page.getByRole("button", { name: "Entrer au comptoir" }).click();
  await expect(page.locator(ALERT)).toHaveText("Identifiant ou mot de passe incorrect.");
});

test("un gérant entre au comptoir et peut se déconnecter", async ({ page }) => {
  await loginAsGerant(page);
  await expect(page.getByTestId("member-name")).toHaveText("Lomone");
  await expect(page.getByRole("link", { name: "Membres" })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/connexion$/);
});

test("un membre change son mot de passe", async ({ page }) => {
  const username = uniqueName("maxarion").toLowerCase();
  await createMember(username, "ancien-mdp", "employe", "Maxarion");
  await loginAs(page, username, "ancien-mdp");

  await page.getByRole("link", { name: "Changer mon mot de passe" }).click();
  await page.getByLabel("Mot de passe actuel").fill("ancien-mdp");
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill("nouveau-mdp");
  await page.getByLabel("Confirmer le nouveau mot de passe").fill("nouveau-mdp");
  await page.getByRole("button", { name: "Changer mon mot de passe" }).click();
  await expect(page.getByRole("status")).toHaveText("Mot de passe changé.");
  await page.goto("/");
  await expect(page.getByTestId("member-name")).toHaveText("Maxarion");

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await loginAs(page, username, "nouveau-mdp");
});
