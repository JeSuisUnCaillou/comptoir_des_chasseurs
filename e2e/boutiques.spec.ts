import { expect, test, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";
import { ALERT, COMPTOIR, GERANT, createMember, loginAsGerant, uniqueName } from "./helpers";

/** Points hidden "id" fields at another row, once the page is hydrated (React would put them back). */
async function retarget(page: Page, inputs: Locator, id: number) {
  await page.waitForLoadState("networkidle");
  await inputs.evaluateAll((elements, value) => {
    for (const input of elements as HTMLInputElement[]) {
      input.value = String(value);
      input.setAttribute("value", String(value));
    }
  }, id);
}

function db() {
  return postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
}

/**
 * Another shop, made straight in the database, with a member, a merchandise
 * named `product` put in stock, a supplier, a parchment and a sale of its own.
 */
async function createOtherShop(product: string) {
  const slug = uniqueName("taverne-du-port").toLowerCase();
  const names = {
    shop: `Taverne ${slug}`,
    member: uniqueName("Tavernier"),
    supplier: uniqueName("Brasseur"),
    announcement: uniqueName("Hydromel à volonté"),
    counterparty: uniqueName("Client de la taverne"),
  };
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [shop] = await sql`insert into shops (name, slug) values (${names.shop}, ${slug}) returning id`;
    const [member] = await sql`
      insert into members (username, name, password_hash)
      values (${names.member.toLowerCase()}, ${names.member}, ${await hashPassword("mot-de-passe")})
      returning id`;
    await sql`insert into shop_members (shop_id, member_id, role) values (${shop.id}, ${member.id}, 'gerant')`;
    const [item] = await sql`
      insert into products (shop_id, name, category, unit, stock, buy_price, sell_price)
      values (${shop.id}, ${product}, 'viande', 'pièce', 9, 1, 2)
      returning id`;
    await sql`
      insert into stock_movements (shop_id, product_id, delta, stock_after, member_id, reason)
      values (${shop.id}, ${item.id}, 9, 9, ${member.id}, 'brassage')`;
    const [supplier] = await sql`
      insert into suppliers (shop_id, name) values (${shop.id}, ${names.supplier}) returning id`;
    await sql`
      insert into announcements (shop_id, title, body, member_id)
      values (${shop.id}, ${names.announcement}, 'Pour tous les clients.', ${member.id})`;
    await sql`
      insert into transactions (shop_id, kind, product_id, label, quantity, amount, counterparty, till_pending, member_id)
      values (${shop.id}, 'vente', ${item.id}, ${product}, 1, 2, ${names.counterparty}, true, ${member.id})`;
    const [line] = await sql`select id from transactions where shop_id = ${shop.id}`;
    return { ...names, slug, shopId: shop.id as number, memberId: member.id, productId: item.id, supplierId: supplier.id, lineId: line.id as number };
  } finally {
    await sql.end();
  }
}

test("le comptoir ne montre rien d'une autre boutique", async ({ page }) => {
  const product = uniqueName("Hydromel");
  const other = await createOtherShop(product);
  await loginAsGerant(page);

  await page.goto(COMPTOIR);
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
  await expect(page.getByText(other.announcement)).toHaveCount(0);

  await page.goto(`/tarifs?q=${encodeURIComponent(product)}`);
  await expect(page.getByRole("heading", { name: "Tarifs", level: 1 })).toBeVisible();
  await expect(page.getByText(product)).toHaveCount(0);

  await page.goto(`/inventaire?q=${encodeURIComponent(product)}`);
  await expect(page.getByTestId(`stock-${product}`)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Inventaire", level: 1 })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(product);
  await expect(page.getByLabel("Employé")).not.toContainText(other.member);

  await page.goto("/achat-vente");
  await expect(page.getByText(other.counterparty)).toHaveCount(0);
  await expect(page.getByLabel("Employé")).not.toContainText(other.member);

  await page.goto("/annonces");
  await expect(page.getByText(other.announcement)).toHaveCount(0);

  await page.goto("/fournisseurs");
  await expect(page.getByRole("heading", { name: "Fournisseurs", level: 1 })).toBeVisible();
  await expect(page.getByText(other.supplier)).toHaveCount(0);

  await page.goto("/membres");
  await expect(page.getByRole("heading", { name: "Membres", level: 1 })).toBeVisible();
  await expect(page.getByText(other.member)).toHaveCount(0);

  // Its pages can't be opened by their address either.
  for (const path of [`/membres/${other.memberId}`, `/marchandises/${other.productId}`, `/fournisseurs/${other.supplierId}`]) {
    await page.goto(path);
    await expect(page.getByText("This page could not be found."), path).toBeVisible();
  }
});

test("deux boutiques peuvent avoir une marchandise du même nom", async ({ page }) => {
  const product = uniqueName("Hydromel");
  await createOtherShop(product);
  await loginAsGerant(page);

  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(product);
  await expect(page.getByText("Aucune marchandise ne correspond.")).toBeVisible();
  await page.getByRole("button", { name: "Nouvelle marchandise" }).click();
  const form = page.getByRole("form", { name: "Nouvelle marchandise" });
  await form.getByLabel("Catégorie").selectOption("viande");
  await form.getByLabel("Quantité ajoutée").fill("2");
  await form.getByLabel("Motif").fill("brassé au comptoir");
  await form.getByRole("button", { name: "Créer et ajouter au stock" }).click();
  await expect(page.getByTestId(`stock-${product}`).getByTestId("stock-value")).toHaveText("2");
});

test("le gérant d'une autre boutique entre dans la sienne, pas au comptoir", async ({ page }) => {
  const product = uniqueName("Hydromel");
  const other = await createOtherShop(product);
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(other.member.toLowerCase());
  await page.getByLabel("Mot de passe").fill("mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();

  // Their only shop opens at its own address, with its own data.
  await expect(page).toHaveURL(new RegExp(`/${other.slug}$`));
  await expect(page.getByTestId("shop-name")).toHaveText(other.shop);
  await expect(page.getByText(other.announcement)).toBeVisible();
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Inventaire" }).click();
  await expect(page).toHaveURL(new RegExp(`/${other.slug}/inventaire$`));
  await expect(page.getByTestId(`stock-${product}`).getByTestId("stock-value")).toHaveText("9");

  // The comptoir's pages send them back to their shop.
  await page.goto(`${COMPTOIR}/achat-vente`);
  await expect(page).toHaveURL(new RegExp(`/${other.slug}$`));
  await page.goto("/achat-vente");
  await expect(page).toHaveURL(new RegExp(`/${other.slug}$`));
});

test("un membre de deux boutiques choisit la sienne, et en change", async ({ page }) => {
  const other = await createOtherShop(uniqueName("Hydromel"));
  const username = uniqueName("Vilkas").toLowerCase();
  await createMember(username, "mot-de-passe", "employe");
  const sql = db();
  try {
    await sql`
      insert into shop_members (shop_id, member_id, role)
      select ${other.shopId}, id, 'gerant' from members where username = ${username}`;
  } finally {
    await sql.end();
  }

  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(username);
  await page.getByLabel("Mot de passe").fill("mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("account-name")).toHaveText(username);
  const shops = page.getByRole("navigation", { name: "Mes boutiques" });
  // Each shop is a card with their role there, and the settings for a gérant only.
  const comptoir = shops.getByRole("article", { name: "Le Comptoir Des Chasseurs" });
  const theirs = shops.getByRole("article", { name: other.shop });
  await expect(comptoir).toContainText("Employé");
  await expect(comptoir).toContainText("/le-comptoir-des-chasseurs");
  await expect(comptoir.getByRole("link", { name: /Réglages/ })).toHaveCount(0);
  await expect(theirs).toContainText("Gérant");
  await expect(theirs).toContainText("2 membres");
  await expect(theirs.getByRole("link", { name: `Réglages de ${other.shop}` })).toHaveAttribute(
    "href",
    `/${other.slug}/reglages`,
  );
  await theirs.getByRole("link", { name: `Entrer dans ${other.shop}` }).click();

  await expect(page).toHaveURL(new RegExp(`/${other.slug}$`));
  await expect(page.getByTestId("shop-name")).toHaveText(other.shop);
  // Gérant there: the Membres page is theirs.
  await expect(page.getByRole("link", { name: "Membres" })).toBeVisible();

  await page.getByRole("link", { name: "Changer de boutique" }).click();
  await comptoir.getByRole("link", { name: "Entrer dans Le Comptoir Des Chasseurs" }).click();
  await expect(page).toHaveURL(new RegExp(`${COMPTOIR}$`));
  await expect(page.getByTestId("shop-name")).toHaveText("Le Comptoir Des Chasseurs");
  // Employé here: no Membres page.
  await expect(page.getByRole("link", { name: "Membres" })).toHaveCount(0);
});

test("une adresse qui ne nomme aucune boutique n'existe pas", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto(`/${uniqueName("nulle-part")}/inventaire`);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("une ligne ou une marchandise d'une autre boutique ne se modifie pas en changeant son numéro", async ({ page }) => {
  const product = uniqueName("Hydromel");
  const other = await createOtherShop(product);
  // A pending sale of the comptoir, whose buttons are turned toward the other shop's line.
  const label = uniqueName("Article du comptoir");
  const sql = db();
  try {
    await sql`
      insert into transactions (shop_id, kind, label, quantity, amount, till_pending, member_id)
      values (1, 'vente', ${label}, 1, 4, true, (select id from members where username = ${GERANT.username}))`;
  } finally {
    await sql.end();
  }
  await loginAsGerant(page);
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/achat-vente?type=attente");
  const row = page.getByTestId("registre").getByRole("row").filter({ hasText: label });
  await retarget(page, row.locator('input[name="id"]'), other.lineId);
  await row.getByRole("button", { name: /Annuler/ }).click();
  await expect(row.locator(ALERT)).toHaveText("Cette ligne est introuvable ou déjà annulée.");
  await row.getByRole("button", { name: /^(Mettre en caisse|Sortir de la caisse)/ }).click();
  await expect(page.locator(ALERT).filter({ hasText: "Cette ligne a déjà été réglée ou annulée." })).toBeVisible();

  // A merchandise of the comptoir saved under the other shop's merchandise's number.
  const mine = uniqueName("Peau du comptoir");
  const sql2 = db();
  try {
    await sql2`insert into products (shop_id, name, category, unit) values (1, ${mine}, 'peau', 'peau')`;
  } finally {
    await sql2.end();
  }
  await page.goto(`/marchandises?q=${encodeURIComponent(mine)}`);
  await page.getByRole("link", { name: `Modifier ${mine}` }).click();
  await retarget(page, page.locator('input[name="id"]'), other.productId);
  await page.getByLabel("Nom").fill(uniqueName("Renommée"));
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page).toHaveURL(/\/marchandises$/);

  const check = db();
  try {
    const [line] = await check`select cancelled_at, till_pending from transactions where id = ${other.lineId}`;
    expect(line).toEqual({ cancelled_at: null, till_pending: true });
    const [item] = await check`select name from products where id = ${other.productId}`;
    expect(item.name).toBe(product);
  } finally {
    await check.end();
  }
});

test("un membre désactivé au comptoir mais actif ailleurs est renvoyé vers sa boutique", async ({ page }) => {
  const other = await createOtherShop(uniqueName("Hydromel"));
  const username = uniqueName("Farkas").toLowerCase();
  await createMember(username, "mot-de-passe", "desactive");
  const sql = db();
  try {
    await sql`
      insert into shop_members (shop_id, member_id, role)
      select ${other.shopId}, id, 'employe' from members where username = ${username}`;
  } finally {
    await sql.end();
  }
  await page.goto(`/connexion?suite=${encodeURIComponent(`${COMPTOIR}/inventaire`)}`);
  await page.getByLabel("Identifiant").fill(username);
  await page.getByLabel("Mot de passe").fill("mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  // Deactivated at the comptoir, they land in the shop they still belong to.
  await expect(page).toHaveURL(new RegExp(`/${other.slug}$`));
  await expect(page.getByTestId("shop-name")).toHaveText(other.shop);
});

test("une ancienne adresse du comptoir garde sa page et ses filtres", async ({ page }) => {
  await loginAsGerant(page);
  await page.getByTestId("member-name").click();
  await expect(page).toHaveURL(/\/membres\/\d+$/);
  const own = new URL(page.url()).pathname.split("/").pop();
  await page.goto(`/membres/${own}?du=2020-01-01&au=2020-01-31`);
  await expect(page).toHaveURL(new RegExp(`${COMPTOIR}/membres/${own}\\?du=2020-01-01&au=2020-01-31$`));
  await expect(page.getByRole("heading", { level: 1, name: "Lomone" })).toBeVisible();
});
