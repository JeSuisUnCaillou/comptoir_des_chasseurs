import { expect, test, type Page } from "@playwright/test";
import { ALERT, createMember, loginAs, newEmployeePage, setRole, uniqueName } from "./helpers";

// Discord is played by e2e/fake-discord.mjs, started by playwright.config.ts.
test.skip(!!process.env.BASE_URL, "Le faux Discord ne tourne qu'avec le serveur local.");

/** A Discord account unique to this test. */
function discordAccount(prefix: string) {
  const name = uniqueName(prefix);
  return { id: String(Math.floor(Math.random() * 1e15)), name };
}

/** On the fake Discord page: says who the visitor is on Discord, and accepts. */
async function approveOnDiscord(page: Page, account: { id: string; name: string }) {
  await expect(page.getByRole("heading", { name: "Faux Discord" })).toBeVisible();
  await page.getByLabel("Identifiant Discord").fill(account.id);
  await page.getByLabel("Nom Discord").fill(account.name);
  await page.getByRole("button", { name: "Autoriser" }).click();
}

async function signInWithDiscord(page: Page, account: { id: string; name: string }, path = "/connexion") {
  await page.goto(path);
  await page.getByRole("link", { name: "Se connecter avec Discord" }).click();
  await approveOnDiscord(page, account);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);
}

test("un membre lie Discord depuis Mon compte, puis entre avec Discord", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "discord-lie");
  const discord = discordAccount("Hrodulf");

  await page.goto("/mot-de-passe");
  await page.getByRole("link", { name: "Lier mon compte Discord" }).click();
  await approveOnDiscord(page, discord);

  await expect(page).toHaveURL(/\/mot-de-passe\?discord=lie$/);
  await expect(page.getByRole("status")).toHaveText(
    "Ton compte Discord est lié : tu peux maintenant te connecter avec Discord.",
  );
  await expect(page.getByText(`Lié au compte Discord ${discord.name}`)).toBeVisible();

  await logout(page);
  await signInWithDiscord(page, discord, "/inventaire");
  await expect(page).toHaveURL(/\/inventaire$/);
  await expect(page.getByRole("heading", { name: "Inventaire", exact: true })).toBeVisible();
});

test("un compte Discord inconnu se lie en entrant une fois avec son mot de passe", async ({ page }) => {
  const username = uniqueName("discord-inconnu").toLowerCase();
  await createMember(username, "mot-de-passe", "employe");
  const discord = discordAccount("Ysolda");

  await signInWithDiscord(page, discord);
  await expect(page).toHaveURL(/\/connexion\?discord=inconnu$/);
  await expect(page.getByRole("status")).toContainText(
    `Ton compte Discord ${discord.name} n'est encore lié à aucun membre.`,
  );
  await expect(page.getByRole("link", { name: "Se connecter avec Discord" })).toBeHidden();

  await loginAs(page, username, "mot-de-passe");
  await page.goto("/mot-de-passe");
  await expect(page.getByText(`Lié au compte Discord ${discord.name}`)).toBeVisible();

  await logout(page);
  await signInWithDiscord(page, discord);
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
});

test("« Ce n'est pas mon compte Discord » ne lie rien", async ({ page }) => {
  const username = uniqueName("discord-pas-moi").toLowerCase();
  await createMember(username, "mot-de-passe", "employe");

  await signInWithDiscord(page, discordAccount("Inconnu"));
  await page.getByRole("button", { name: "Ce n'est pas mon compte Discord" }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole("status")).toBeHidden();

  await loginAs(page, username, "mot-de-passe");
  await page.goto("/mot-de-passe");
  await expect(page.getByRole("link", { name: "Lier mon compte Discord" })).toBeVisible();
});

test("un compte Discord ne se lie qu'à un seul membre", async ({ browser }) => {
  const discord = discordAccount("Partage");
  const first = await newEmployeePage(browser, "discord-premier");
  await first.page.goto("/mot-de-passe");
  await first.page.getByRole("link", { name: "Lier mon compte Discord" }).click();
  await approveOnDiscord(first.page, discord);
  await expect(first.page.getByText(`Lié au compte Discord ${discord.name}`)).toBeVisible();

  const second = await newEmployeePage(browser, "discord-second");
  await second.page.goto("/mot-de-passe");
  await second.page.getByRole("link", { name: "Lier mon compte Discord" }).click();
  await approveOnDiscord(second.page, discord);
  await expect(second.page.locator(ALERT)).toHaveText("Ce compte Discord est déjà lié à un autre membre.");
  await expect(second.page.getByRole("link", { name: "Lier mon compte Discord" })).toBeVisible();
});

test("délier Discord ferme les sessions ouvertes avec Discord", async ({ browser }) => {
  const { page, username } = await newEmployeePage(browser, "discord-delie");
  const discord = discordAccount("Delie");
  await page.goto("/mot-de-passe");
  await page.getByRole("link", { name: "Lier mon compte Discord" }).click();
  await approveOnDiscord(page, discord);
  await expect(page.getByText(`Lié au compte Discord ${discord.name}`)).toBeVisible();

  const other = await (await browser.newContext()).newPage();
  await signInWithDiscord(other, discord);
  await expect(other.getByRole("heading", { name: "Grand livre" })).toBeVisible();

  await page.getByRole("button", { name: "Délier Discord" }).click();
  await expect(page.getByRole("status")).toHaveText("Discord n'est plus lié à ton compte.");
  await expect(page.getByRole("link", { name: "Lier mon compte Discord" })).toBeVisible();

  await other.reload();
  await expect(other).toHaveURL(/\/connexion/);
  await signInWithDiscord(other, discord);
  await expect(other.getByRole("status")).toContainText("n'est encore lié à aucun membre");
  await loginAs(other, username, "mot-de-passe");
});

test("un membre désactivé n'entre pas avec Discord", async ({ browser }) => {
  const { page, username } = await newEmployeePage(browser, "discord-desactive");
  const discord = discordAccount("Desactive");
  await page.goto("/mot-de-passe");
  await page.getByRole("link", { name: "Lier mon compte Discord" }).click();
  await approveOnDiscord(page, discord);
  await expect(page.getByText(`Lié au compte Discord ${discord.name}`)).toBeVisible();
  await logout(page);

  await setRole(username, "desactive");
  await signInWithDiscord(page, discord);
  await expect(page.locator(ALERT)).toHaveText("Ce compte n'a plus accès à aucune boutique.");
});

test("refuser sur Discord ramène à la connexion avec un message", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("link", { name: "Se connecter avec Discord" }).click();
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.locator(ALERT)).toHaveText("La connexion avec Discord n'a pas abouti. Réessaie.");
});

test("un retour de Discord sans le bon état ne connecte personne", async ({ page }) => {
  await page.goto("/auth/discord/callback?code=forge&state=forge");
  await expect(page).toHaveURL(/\/connexion\?discord=erreur$/);
  await expect(page.locator(ALERT)).toHaveText("La connexion avec Discord n'a pas abouti. Réessaie.");
});
