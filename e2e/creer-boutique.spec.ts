import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import { ALERT, COMPTOIR, createMember, loginAs, loginAsGerant, newEmployeePage, setRole, uniqueName } from "./helpers";

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
  await page.getByRole("link", { name: "Changer de boutique" }).click();
  await expect(page).toHaveURL(/\/boutiques$/);
  const section = page.getByRole("region", { name: "Ouvrir une boutique pour quelqu'un" });
  await section.getByLabel("Nom de sa boutique").fill(shop);
  await section.getByRole("button", { name: "Créer le lien d'invitation" }).click();
  await expect(section.getByRole("status")).toContainText(`Boutique « ${shop} » ouverte.`);
  const link = section.getByLabel("Nouveau lien d'invitation");
  await expect(link).toHaveValue(/\/invitation\/[\w-]{20,}$/);
  return link.inputValue();
}

test("le super admin ouvre une boutique, dont il est le gérant", async ({ page }) => {
  const shop = uniqueName("Échoppe de Lomone");
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Changer de boutique" }).click();
  const section = page.getByRole("region", { name: "Ouvrir une boutique", exact: true });
  await section.getByLabel("Nom de la boutique").fill(shop);
  await section.getByRole("button", { name: "Ouvrir la boutique" }).click();

  await expect(page).toHaveURL(new RegExp(`/${slugOf(shop)}$`));
  await expect(page.getByTestId("shop-name")).toHaveText(shop);
  await expect(page.getByRole("link", { name: "Membres" })).toBeVisible();
  // A new shop starts empty.
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Inventaire" }).click();
  await expect(page.getByText("Aucune marchandise ne correspond.")).toBeVisible();

  await page.goto("/boutiques");
  await expect(page.getByRole("navigation", { name: "Mes boutiques" }).getByRole("article", { name: shop })).toContainText(
    "Gérant",
  );
});

test("un employé n'ouvre pas de boutique : il le demande au super admin", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "ysolda");
  await page.getByRole("link", { name: "Changer de boutique" }).click();
  await expect(page).toHaveURL(/\/boutiques$/);
  await expect(page.getByRole("navigation", { name: "Mes boutiques" }).getByRole("article")).toHaveCount(1);
  await expect(page.getByText("Pour ouvrir une nouvelle boutique, demande au super admin.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Ouvrir une boutique", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ouvrir une boutique pour quelqu'un" })).toHaveCount(0);
});

test("un compte qui n'est plus super admin ne peut plus ouvrir de boutique, même d'un onglet resté ouvert", async ({ browser }) => {
  const username = uniqueName("tolfdir").toLowerCase();
  await createMember(username, "mot-de-passe", "gerant");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update members set super_admin = true where username = ${username}`;
    const page = await (await browser.newContext()).newPage();
    await loginAs(page, username, "mot-de-passe");
    await page.goto("/boutiques");
    const opening = page.getByRole("region", { name: "Ouvrir une boutique", exact: true });
    const inviting = page.getByRole("region", { name: "Ouvrir une boutique pour quelqu'un" });
    await expect(opening).toBeVisible();

    // The tab stays open while the account loses the role.
    await sql`update members set super_admin = false where username = ${username}`;
    const shop = uniqueName("Boutique refusée");
    await opening.getByLabel("Nom de la boutique").fill(shop);
    await opening.getByRole("button", { name: "Ouvrir la boutique" }).click();
    await expect(opening.locator(ALERT)).toHaveText("Seul le super admin peut ouvrir une boutique.");
    await inviting.getByLabel("Nom de sa boutique").fill(shop);
    await inviting.getByRole("button", { name: "Créer le lien d'invitation" }).click();
    await expect(inviting.locator(ALERT)).toHaveText("Seul le super admin peut ouvrir une boutique.");
    const [{ count }] = await sql`select count(*)::int as count from shops where name = ${shop}`;
    expect(count).toBe(0);
  } finally {
    await sql.end();
  }
});

test("une boutique ne prend pas une adresse déjà prise ou réservée", async ({ page }) => {
  await loginAsGerant(page);
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
  // Its address would hide the Discord sign-in.
  await name.fill("Auth");
  await open.click();
  await expect(section.locator(ALERT)).toHaveText("L'adresse /auth est réservée : choisis un autre nom.");
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
  const pending = page.getByRole("region", { name: "Invitations en attente" });
  await expect(pending.getByLabel(`Lien d'invitation de ${shop}`)).toHaveValue(link);
  // The link copies in one click.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const row = pending.getByRole("listitem").filter({ hasText: shop });
  await row.getByRole("button", { name: "Copier" }).click();
  await expect(row.getByRole("button", { name: "Copié" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

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
  await guest.getByRole("button", { name: "Se connecter" }).click();

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

test("connecté avec un autre compte, on se déconnecte sans perdre l'invitation", async ({ page, browser }) => {
  const shop = uniqueName("Étal de Riverwood");
  const link = await invite(page, shop);
  const { page: someone } = await newEmployeePage(browser, "sven");
  await someone.goto(link);
  await expect(someone.getByRole("button", { name: `Devenir gérant de « ${shop} »` })).toBeVisible();
  await someone.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(someone.getByRole("button", { name: "Créer mon compte et entrer" })).toBeVisible();
  expect(someone.url()).toBe(link);
});

test("un lien d'invitation inconnu n'ouvre rien", async ({ page }) => {
  await page.goto(`/invitation/${uniqueName("faux-lien")}`);
  await expect(page.locator(ALERT)).toContainText("Cette invitation n'est plus valable");
  await expect(page.getByLabel("Identifiant")).toHaveCount(0);
});

/** An employee of the comptoir who is also the gérant of a shop of their own, on its Grand livre. */
async function ownShop(browser: Browser, prefix: string) {
  const { page, username } = await newEmployeePage(browser, prefix);
  const shop = uniqueName(`Boutique de ${prefix}`);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      with shop as (insert into shops (name, slug) values (${shop}, ${slugOf(shop)}) returning id)
      insert into shop_members (shop_id, member_id, role)
      select shop.id, members.id, 'gerant' from shop, members where members.username = ${username}`;
  } finally {
    await sql.end();
  }
  await page.goto(`/${slugOf(shop)}`);
  await expect(page.getByTestId("shop-name")).toHaveText(shop);
  return { page, username, shop, slug: slugOf(shop) };
}

test("un gérant renomme sa boutique et change son adresse", async ({ browser }) => {
  const { page, slug } = await ownShop(browser, "idgrod");
  const renamed = uniqueName("Maison des Chants");
  await page.getByRole("link", { name: "Réglages" }).click();
  // The brand names the app, not a shop.
  await expect(page.getByText("de Lomone", { exact: true })).toBeVisible();
  // The shop's link follows the address as it is typed.
  const link = page.getByTestId("shop-link");
  await expect(link).toHaveText(new RegExp(`^http://localhost:\\d+/${slug}$`));
  await page.getByLabel("Nom de la boutique").fill(renamed);
  await page.getByLabel("Adresse").fill(renamed);
  await expect(link).toHaveText(new RegExp(`/${slugOf(renamed)}$`));
  await page.getByLabel("Adresse").fill("✦");
  await expect(page.getByText("l'adresse doit contenir au moins une lettre ou un chiffre.")).toBeVisible();
  await page.getByLabel("Adresse").fill(renamed);
  await page.getByRole("button", { name: "Enregistrer la boutique" }).click();

  await expect(page).toHaveURL(new RegExp(`/${slugOf(renamed)}/reglages$`));
  await expect(page.getByTestId("shop-name")).toHaveText(renamed);
  await page.goto(`/${slug}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();

  // Another shop's address is refused.
  await page.goto(`/${slugOf(renamed)}/reglages`);
  await page.getByLabel("Adresse").fill("le-comptoir-des-chasseurs");
  await page.getByRole("button", { name: "Enregistrer la boutique" }).click();
  await expect(page.locator(ALERT)).toHaveText(
    "Une boutique a déjà l'adresse /le-comptoir-des-chasseurs : choisis un autre nom.",
  );
});

test("un gérant supprime sa boutique, avec tout ce qu'elle contient", async ({ browser }) => {
  const { page, shop, slug } = await ownShop(browser, "gerdur");
  // Something in it: a merchandise put in stock.
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Inventaire" }).click();
  await page.getByLabel("Rechercher une marchandise").fill(uniqueName("Hydromel"));
  await page.getByRole("button", { name: "Nouvelle marchandise" }).click();
  const form = page.getByRole("form", { name: "Nouvelle marchandise" });
  await form.getByLabel("Catégorie").selectOption("viande");
  await form.getByLabel("Quantité ajoutée").fill("3");
  await form.getByLabel("Motif").fill("brassé sur place");
  await form.getByRole("button", { name: "Créer et ajouter au stock" }).click();
  await expect(page.getByTestId("stock-value")).toHaveText("3");
  // And a sale of it, a supplier offering it, a parchment and an invitation.
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [{ shopId, productId, memberId }] = await sql`
      select s.id as "shopId", p.id as "productId", sm.member_id as "memberId"
      from shops s join products p on p.shop_id = s.id join shop_members sm on sm.shop_id = s.id
      where s.slug = ${slug}`;
    const [sale] = await sql`
      insert into transactions (shop_id, kind, product_id, label, quantity, amount, member_id)
      values (${shopId}, 'vente', ${productId}, 'Hydromel', 1, 5, ${memberId}) returning id`;
    await sql`
      insert into stock_movements (shop_id, product_id, delta, stock_after, member_id, reason, transaction_id)
      values (${shopId}, ${productId}, -1, 2, ${memberId}, 'Vente', ${sale.id})`;
    const [supplier] = await sql`insert into suppliers (shop_id, name) values (${shopId}, 'Brasseur') returning id`;
    await sql`insert into supplier_offers (supplier_id, product_id, price) values (${supplier.id}, ${productId}, 2)`;
    await sql`insert into announcements (shop_id, title, body, member_id) values (${shopId}, 'Fermeture', 'Bientôt', ${memberId})`;
    await sql`insert into shop_invitations (token, shop_id, created_by) values (${uniqueName("jeton")}, ${shopId}, ${memberId})`;
  } finally {
    await sql.end();
  }

  await page.getByRole("link", { name: "Réglages" }).click();
  const danger = page.getByRole("region", { name: "Supprimer la boutique" });
  await danger.getByLabel(`Pour confirmer, écris « ${shop} »`).fill("pas le bon nom");
  await danger.getByRole("button", { name: "Supprimer la boutique" }).click();
  await expect(danger.locator(ALERT)).toHaveText("Écris exactement le nom de la boutique pour confirmer.");
  await danger.getByLabel(`Pour confirmer, écris « ${shop} »`).fill(shop);
  await danger.getByRole("button", { name: "Supprimer la boutique" }).click();

  await expect(page).toHaveURL(/\/boutiques$/);
  await expect(page.getByRole("navigation", { name: "Mes boutiques" }).getByRole("heading")).toHaveText([
    "Le Comptoir Des Chasseurs",
  ]);
  await page.goto(`/${slug}`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("le comptoir garde son adresse et ne se supprime pas ; un employé n'a pas les réglages", async ({ page, browser }) => {
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Réglages" }).click();
  await expect(page.getByLabel("Adresse")).toBeDisabled();
  await expect(page.getByRole("region", { name: "Supprimer la boutique" })).toHaveCount(0);

  const { page: employee } = await newEmployeePage(browser, "lars");
  await expect(employee.getByRole("link", { name: "Réglages" })).toHaveCount(0);
  await employee.goto(`${COMPTOIR}/reglages`);
  await expect(employee).toHaveURL(new RegExp(`${COMPTOIR}$`));
});

test("un gérant ne supprime pas sa seule boutique", async ({ browser }) => {
  const { page, username, shop } = await ownShop(browser, "olfina");
  // Their shop is now the only one they are active in.
  await setRole(username, "desactive");
  await page.goto(`/${slugOf(shop)}/reglages`);
  const danger = page.getByRole("region", { name: "Supprimer la boutique" });
  await danger.getByLabel(`Pour confirmer, écris « ${shop} »`).fill(shop);
  await danger.getByRole("button", { name: "Supprimer la boutique" }).click();
  await expect(danger.locator(ALERT)).toHaveText(
    "C'est ta seule boutique : sans elle, tu ne pourrais plus te connecter.",
  );
  await page.reload();
  await expect(page.getByTestId("shop-name")).toHaveText(shop);
});
