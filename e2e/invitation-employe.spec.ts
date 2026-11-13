import { expect, test, type Page } from "@playwright/test";
import { ALERT, COMPTOIR, createMember, loginAs, loginAsGerant, memberRow, uniqueName } from "./helpers";

// "Entrer avec Discord" goes through e2e/fake-discord.mjs, started by playwright.config.ts.
test.skip(!!process.env.BASE_URL, "Le faux Discord ne tourne qu'avec le serveur local.");

/** In Membres, creates an employé invitation link and returns it. */
async function createEmployeeLink(page: Page) {
  await page.goto(`${COMPTOIR}/membres`);
  const section = page.getByRole("region", { name: "Inviter un employé" });
  await section.getByRole("button", { name: "Créer un lien d'invitation" }).click();
  const link = section.getByLabel("Nouveau lien d'invitation");
  await expect(link).toHaveValue(/\/invitation\/[\w-]{20,}$/);
  // Also listed with the links not used yet.
  await expect(section.getByLabel("Lien d'invitation d'employé").first()).toBeVisible();
  return link.inputValue();
}

async function enterWithDiscord(page: Page, link: string, account: { id: string; name: string }) {
  await page.goto(link);
  await expect(page.getByText("Tu es invité à rejoindre la boutique")).toContainText("comme employé");
  await page.getByRole("link", { name: "Entrer avec Discord" }).click();
  await page.getByLabel("Identifiant Discord").fill(account.id);
  await page.getByLabel("Nom Discord").fill(account.name);
  await page.getByRole("button", { name: "Autoriser" }).click();
}

function discordAccount(prefix: string) {
  return { id: String(Math.floor(Math.random() * 1e15)), name: uniqueName(prefix) };
}

test("un gérant invite un employé, qui entre avec Discord seul puis choisit un mot de passe", async ({
  page,
  browser,
}) => {
  const gerant = uniqueName("gerant-invite").toLowerCase();
  await createMember(gerant, "mot-de-passe", "gerant");
  await loginAs(page, gerant, "mot-de-passe");
  const link = await createEmployeeLink(page);

  const discord = discordAccount("Brynjolf");
  const username = discord.name.toLowerCase();
  const newcomer = await (await browser.newContext()).newPage();
  await enterWithDiscord(newcomer, link, discord);
  await expect(newcomer).toHaveURL(new RegExp(`${COMPTOIR}$`));
  await expect(newcomer.getByRole("heading", { name: "Grand livre" })).toBeVisible();

  // An employé of the shop, named after Discord.
  await page.reload();
  const row = await memberRow(page, username);
  await expect(row.getByLabel("Rôle")).toHaveValue("employe");
  await expect(row.getByLabel("Nom affiché")).toHaveValue(discord.name);

  // No password yet: Discord can't be unlinked, and the first password needs no current one.
  await newcomer.goto(`${COMPTOIR}/mot-de-passe`);
  await expect(newcomer.getByText(`Identifiant : ${username}`)).toBeVisible();
  await expect(newcomer.getByText("Pour délier Discord, choisis d'abord un mot de passe.")).toBeVisible();
  await expect(newcomer.getByRole("button", { name: "Délier Discord" })).toBeHidden();
  await expect(newcomer.getByLabel("Mot de passe actuel")).toBeHidden();
  await newcomer.getByLabel("Nouveau mot de passe", { exact: true }).fill("son-secret");
  await newcomer.getByLabel("Confirmer le nouveau mot de passe").fill("son-secret");
  await newcomer.getByRole("button", { name: "Choisir mon mot de passe" }).click();
  await expect(newcomer.getByRole("status")).toHaveText("Mot de passe choisi.");
  await expect(newcomer.getByLabel("Mot de passe actuel")).toBeVisible();
  await expect(newcomer.getByRole("button", { name: "Délier Discord" })).toBeVisible();

  // The password now opens the account too.
  const other = await (await browser.newContext()).newPage();
  await loginAs(other, username, "son-secret");
});

test("le super admin invite aussi un employé ; le lien ne sert qu'une fois", async ({ page, browser }) => {
  await loginAsGerant(page);
  const link = await createEmployeeLink(page);

  const first = await (await browser.newContext()).newPage();
  await enterWithDiscord(first, link, discordAccount("Premier"));
  await expect(first.getByRole("heading", { name: "Grand livre" })).toBeVisible();

  const second = await (await browser.newContext()).newPage();
  await second.goto(link);
  await expect(second.locator(ALERT)).toHaveText(
    "Cette invitation n'est plus valable : elle a déjà servi, ou le lien est incomplet.",
  );
});

test("un identifiant déjà pris reçoit un numéro", async ({ page, browser }) => {
  const discord = discordAccount("Homonyme");
  const taken = discord.name.toLowerCase();
  await createMember(taken, "mot-de-passe", "employe");
  await loginAsGerant(page);
  const link = await createEmployeeLink(page);

  const newcomer = await (await browser.newContext()).newPage();
  await enterWithDiscord(newcomer, link, discord);
  await newcomer.goto(`${COMPTOIR}/mot-de-passe`);
  await expect(newcomer.getByText(`Identifiant : ${taken}-2`)).toBeVisible();
});

test("un compte lié à Discord et désactivé ne revient pas par un lien d'employé", async ({
  page,
  browser,
}) => {
  const username = uniqueName("deja-lie").toLowerCase();
  await createMember(username, "mot-de-passe", "desactive");
  const discord = discordAccount("DejaLie");
  // Linked while still an employé elsewhere: here, straight in the database is simpler.
  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update members set discord_id = ${discord.id}, discord_name = ${discord.name} where username = ${username}`;
  } finally {
    await sql.end();
  }

  await loginAsGerant(page);
  const link = await createEmployeeLink(page);
  const member = await (await browser.newContext()).newPage();
  await enterWithDiscord(member, link, discord);
  await expect(member).not.toHaveURL(/\/auth\/discord/);

  // A member a gérant deactivated stays deactivated: the link doesn't bring them back.
  await page.reload();
  const row = await memberRow(page, username);
  await expect(row.getByLabel("Rôle")).toHaveValue("desactive");
});
