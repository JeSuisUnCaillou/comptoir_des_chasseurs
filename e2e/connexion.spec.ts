import { expect, test } from "@playwright/test";
import { GERANT, createMember, loginAs, loginAsGerant, uniqueName } from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

test("un visiteur non connecté arrive sur la page de connexion", async ({ page }) => {
  await page.goto("/inventaire");

  await expect(page).toHaveURL(/\/connexion\?suite=%2Finventaire$/);
  await expect(page.getByRole("heading", { name: /Comptoir\s*de Chasse/ })).toBeVisible();
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
  test(`un lien de connexion vers un autre site (${suite}) ramène au Grand livre`, async ({
    page,
  }) => {
    await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
    await page.getByLabel("Identifiant").fill(GERANT.username);
    await page.getByLabel("Mot de passe").fill(GERANT.password);
    await page.getByRole("button", { name: "Entrer au comptoir" }).click();

    await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");

    // Already signed in, the same link redirects straight away.
    await page.goto(`/connexion?suite=${encodeURIComponent(suite)}`);
    await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
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
