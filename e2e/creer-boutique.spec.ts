import { expect, test, type Page } from "@playwright/test";
import { ALERT, COMPTOIR, createMember, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

/** The address a shop named `name` gets: what the page says, lower case, accents dropped, dashes. */
function slugOf(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The super admin opens a shop for someone, from Mes boutiques, and returns its invitation link. */
async function invite(page: Page, shop: string) {
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Mes boutiques" }).click();
  await expect(page).toHaveURL(/\/boutiques$/);
  const section = page.getByRole("region", { name: "Ouvrir une boutique pour quelqu'un" });
  await section.getByLabel("Nom de sa boutique").fill(shop);
  await section.getByRole("button", { name: "Créer le lien d'invitation" }).click();
  await expect(section.getByRole("status")).toContainText(`Boutique « ${shop} » ouverte.`);
  const link = section.getByLabel("Nouveau lien d'invitation");
  await expect(link).toHaveValue(/\/invitation\/[\w-]{20,}$/);
  return link.inputValue();
}

test("un employé ouvre sa propre boutique, dont il est le gérant", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "ysolda");
  const shop = uniqueName("Échoppe d'Ysolda");
  await expect(page.getByRole("link", { name: "Membres" })).toHaveCount(0);

  await page.getByRole("link", { name: "Mes boutiques" }).click();
  const section = page.getByRole("region", { name: "Ouvrir une boutique", exact: true });
  await section.getByLabel("Nom de la boutique").fill(shop);
  await section.getByRole("button", { name: "Ouvrir la boutique" }).click();

  await expect(page).toHaveURL(new RegExp(`/${slugOf(shop)}$`));
  await expect(page.getByTestId("shop-name")).toHaveText(shop);
  await expect(page.getByRole("link", { name: "Membres" })).toBeVisible();
  // A new shop starts empty.
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Inventaire" }).click();
  await expect(page.getByText("Aucune marchandise ne correspond.")).toBeVisible();

  // Both shops are now theirs to choose from, with their role in each.
  await page.goto("/");
  await expect(page).toHaveURL(/\/boutiques$/);
  const shops = page.getByRole("navigation", { name: "Mes boutiques" });
  await expect(shops.getByRole("link", { name: /Le Comptoir Des Chasseurs · Employé/ })).toBeVisible();
  await expect(shops.getByRole("link", { name: `${shop} · Gérant` })).toBeVisible();
  // Only the super admin invites someone else.
  await expect(page.getByRole("region", { name: "Ouvrir une boutique pour quelqu'un" })).toHaveCount(0);
});

test("une boutique ne prend pas une adresse déjà prise ou réservée", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "brenuin");
  await page.goto("/boutiques");
  const section = page.getByRole("region", { name: "Ouvrir une boutique", exact: true });
  const name = section.getByLabel("Nom de la boutique");
  const open = section.getByRole("button", { name: "Ouvrir la boutique" });

  await name.fill("Le comptoir des chasseurs");
  await open.click();
  await expect(section.locator(ALERT)).toHaveText(
    "Une boutique a déjà l'adresse /le-comptoir-des-chasseurs : choisis un autre nom.",
  );
  await name.fill("Inventaire");
  await open.click();
  await expect(section.locator(ALERT)).toHaveText("L'adresse /inventaire est réservée : choisis un autre nom.");
  await name.fill("✦ ✦");
  await open.click();
  await expect(section.locator(ALERT)).toHaveText(
    "Le nom de la boutique doit contenir au moins une lettre ou un chiffre.",
  );
  await expect(page).toHaveURL(/\/boutiques$/);
});

test("le super admin invite un nouveau gérant, qui crée son compte avec le lien", async ({ page, browser }) => {
  const shop = uniqueName("Taverne du Port");
  const link = await invite(page, shop);
  const pending = page.getByRole("list", { name: "Invitations en attente" });
  await expect(pending.getByLabel(`Lien d'invitation de ${shop}`)).toHaveValue(link);

  const username = uniqueName("hulda").toLowerCase();
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(link);
  await expect(guest.getByText(`Tu es invité à gérer la boutique « ${shop} »`)).toBeVisible();
  await guest.getByLabel("Identifiant").fill(username);
  await guest.getByLabel("Nom affiché dans les registres").fill("Hulda");
  await guest.getByLabel("Mot de passe", { exact: true }).fill("jument-pie");
  await guest.getByLabel("Confirmer le mot de passe").fill("jument-pie");
  await guest.getByRole("button", { name: "Créer mon compte et entrer" }).click();

  await expect(guest).toHaveURL(new RegExp(`/${slugOf(shop)}$`));
  await expect(guest.getByTestId("shop-name")).toHaveText(shop);
  await expect(guest.getByTestId("member-name")).toHaveText("Hulda");
  await guest.getByRole("link", { name: "Membres" }).click();
  await expect(guest.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
  // Only in their shop: the comptoir's pages send them back to it.
  await guest.goto(COMPTOIR);
  await expect(guest).toHaveURL(new RegExp(`/${slugOf(shop)}$`));

  // The link has served: nobody else can take it, and it is no longer pending.
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(other.locator(ALERT)).toContainText("Cette invitation n'est plus valable");
  await page.reload();
  await expect(page.getByLabel(`Lien d'invitation de ${shop}`)).toHaveCount(0);
});

test("un compte existant prend une invitation en se connectant d'abord", async ({ page, browser }) => {
  const shop = uniqueName("Forge de Vendeaume");
  const link = await invite(page, shop);
  const username = uniqueName("adrianne").toLowerCase();
  await createMember(username, "mot-de-passe", "employe");

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(link);
  await guest.getByRole("link", { name: "J'ai déjà un compte : me connecter" }).click();
  await expect(guest).toHaveURL(/\/connexion\?suite=/);
  await guest.getByLabel("Identifiant").fill(username);
  await guest.getByLabel("Mot de passe").fill("mot-de-passe");
  await guest.getByRole("button", { name: "Entrer au comptoir" }).click();

  // Back on the invitation, signed in.
  await expect(guest).toHaveURL(new RegExp(`/invitation/`));
  await guest.getByRole("button", { name: `Devenir gérant de « ${shop} »` }).click();
  await expect(guest).toHaveURL(new RegExp(`/${slugOf(shop)}$`));
  await expect(guest.getByRole("link", { name: "Membres" })).toBeVisible();

  // Still an employee at the comptoir.
  await guest.goto(COMPTOIR);
  await expect(guest.getByTestId("shop-name")).toHaveText("Le Comptoir Des Chasseurs");
  await expect(guest.getByRole("link", { name: "Membres" })).toHaveCount(0);
});

test("un lien d'invitation inconnu n'ouvre rien", async ({ page }) => {
  await page.goto(`/invitation/${uniqueName("faux-lien")}`);
  await expect(page.locator(ALERT)).toContainText("Cette invitation n'est plus valable");
  await expect(page.getByLabel("Identifiant")).toHaveCount(0);
});
