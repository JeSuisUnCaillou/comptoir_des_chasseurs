import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { hashPassword } from "../lib/auth/password";
import {
  CITIZENS,
  createProduct,
  loginAsGerant,
  newEmployeePage,
  pickProduct,
  setPrivilegedPrice,
  uniqueName,
} from "./helpers";

test("le gérant fixe un prix de rachat pour les citoyens d'Estemarche, appliqué à l'achat", async ({
  page,
  browser,
}) => {
  const name = uniqueName("Cuir tanné");
  await loginAsGerant(page);
  await page.goto("/marchandises");
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill(name);
  await form.getByLabel("Catégorie").selectOption("ressource");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).first().fill("3");
  await form.getByLabel(`Prix pour : ${CITIZENS}`).fill("4");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).nth(1).fill("6");
  await form.getByRole("button", { name: "Ajouter la marchandise" }).click();
  await expect(page).toHaveURL(/\/marchandises$/);

  // Both buyback prices show on Tarifs, for every member.
  const { page: employee } = await newEmployeePage(browser, "brand-shei");
  await employee.getByRole("link", { name: "Tarifs" }).click();
  const row = employee.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("3 septims / unité");
  await expect(row).toContainText(`${CITIZENS} : 4 septims / unité`);

  // The amount follows the seller's privileged group.
  await employee.goto("/achat-vente/achat");
  const purchase = employee.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(purchase, name);
  await purchase.getByLabel("Quantité").fill("10");
  const amount = purchase.getByLabel("Montant (septims)");
  const citizen = purchase.getByRole("radio", { name: CITIZENS });
  const none = purchase.getByRole("radio", { name: "Aucun" });
  await expect(purchase.getByRole("group", { name: "Prix privilégié du vendeur" })).toBeVisible();
  await expect(purchase.getByText(`${CITIZENS} : 4 septims / unité · autres vendeurs : 3 septims / unité`)).toBeVisible();
  await expect(none).toBeChecked();
  await expect(amount).toHaveValue("30");
  await expect(purchase.getByTestId("prix-par-defaut")).toHaveText("Prix par défaut : 3 septims / unité");
  await citizen.check();
  await expect(amount).toHaveValue("40");
  await expect(purchase.getByTestId("tarif")).toContainText(`prix privilégié : ${CITIZENS}`);
  await expect(purchase.getByTestId("prix-par-defaut")).toHaveText(
    `Prix par défaut : 4 septims / unité (prix privilégié : ${CITIZENS})`,
  );
  await none.check();
  await expect(amount).toHaveValue("30");
  await citizen.check();
  await purchase.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(employee.getByRole("status").filter({ hasText: `10 × ${name}` })).toHaveText(
    `Achat inscrit : 10 × ${name}, 40 septims.`,
  );
});

test("sans prix privilégié, l'achat ne propose pas de choix", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "onmund");
  await page.goto("/achat-vente/achat");
  const purchase = page.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(purchase, "Biche");
  await expect(purchase.getByLabel("Montant (septims)")).not.toHaveValue("");
  await expect(purchase.getByRole("group", { name: "Prix privilégié du vendeur" })).toHaveCount(0);
});

test("le prix privilégié du produit phare a sa propre tuile sur les Tarifs", async ({ browser }) => {
  // The seeded leather; no other test reads its tiles.
  await setPrivilegedPrice("Cuir", 5);
  const { page } = await newEmployeePage(browser, "ralof");
  await page.getByRole("link", { name: "Tarifs" }).click();
  const leather = page.getByRole("region", { name: "Cuir", exact: true });
  await expect(leather).toContainText("Rachat · autres vendeurs4 septims");
  await expect(leather.getByTestId("rachat-phare-privilegie")).toHaveText(`Rachat · ${CITIZENS}5 septims`);
  // Buyback prices on the first line, resale prices on the second.
  const box = async (label: string) => (await leather.locator(".stat").filter({ hasText: label }).boundingBox())!;
  const top = async (label: string) => (await box(label)).y;
  // The privileged price comes first.
  expect(await top("autres vendeurs")).toBe(await top(CITIZENS));
  expect((await box(CITIZENS)).x).toBeLessThan((await box("autres vendeurs")).x);
  expect(await top("Vente")).toBeGreaterThan(await top(CITIZENS));
  expect(await top("Vente")).toBe(await top("Rachat par le forgeron"));
});

test("à l'achat de plusieurs marchandises, un seul choix pour le vendeur", async ({ browser }) => {
  const leather = uniqueName("Cuir épais");
  const hide = uniqueName("Peau de daim");
  await createProduct(leather, { buyPrice: 3, category: "cuir", unit: "pièce" });
  await createProduct(hide, { buyPrice: 2 });
  await setPrivilegedPrice(leather, 4);
  const { page } = await newEmployeePage(browser, "camilla");
  await page.goto("/achat-vente/achat");
  const purchase = page.getByRole("region", { name: "Inscrire un achat" });
  const line = (n: number) => purchase.getByRole("group", { name: `Marchandise ${n}`, exact: true });
  const citizen = purchase.getByRole("radio", { name: CITIZENS });
  const total = purchase.getByTestId("total");

  await pickProduct(line(1), hide);
  await line(1).getByLabel("Quantité").fill("2");
  await expect(citizen).toHaveCount(0);
  await purchase.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(line(2), leather);
  await line(2).getByLabel("Quantité").fill("10");
  await expect(total).toHaveText("Total de l'achat : 34 septims");

  // The choice only changes the lines that have a price for the group.
  await citizen.check();
  await expect(line(1).getByLabel("Montant (septims)")).toHaveValue("4");
  await expect(line(2).getByLabel("Montant (septims)")).toHaveValue("40");
  await expect(total).toHaveText("Total de l'achat : 44 septims");
  // Without the leather the choice goes away, and comes back on « Aucun ».
  await pickProduct(line(2), hide);
  await expect(citizen).toHaveCount(0);
  await pickProduct(line(2), leather);
  await expect(citizen).not.toBeChecked();
  await expect(total).toHaveText("Total de l'achat : 34 septims");
  await citizen.check();
  await purchase.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(page.getByRole("status").filter({ hasText: leather })).toHaveText(
    `Achat inscrit : 2 × ${hide}, 10 × ${leather}, 44 septims au total.`,
  );
});

/**
 * A shop of its own, made straight in the database, with no privileged group,
 * its gérant signed in on its Gérer les marchandises, and one merchandise.
 */
async function newShop(page: Page) {
  const slug = uniqueName("relais").toLowerCase();
  const gerant = uniqueName("Relayeur").toLowerCase();
  const product = uniqueName("Cuir de relais");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [shop] = await sql`insert into shops (name, slug) values (${`Relais ${slug}`}, ${slug}) returning id`;
    const [member] = await sql`
      insert into members (username, name, password_hash)
      values (${gerant}, ${gerant}, ${await hashPassword("mot-de-passe")})
      returning id`;
    await sql`insert into shop_members (shop_id, member_id, role) values (${shop.id}, ${member.id}, 'gerant')`;
    await sql`
      insert into products (shop_id, name, category, unit, buy_price, buy_qty, sell_price)
      values (${shop.id}, ${product}, 'cuir', 'pièce', 3, 1, 6)`;
  } finally {
    await sql.end();
  }
  // The only shop of the account: signing in opens it.
  await page.goto("/connexion");
  await page.getByLabel("Identifiant").fill(gerant);
  await page.getByLabel("Mot de passe").fill("mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
  await page.goto(`/${slug}/marchandises`);
  return { slug, product };
}

test("le gérant nomme ses clients privilégiés, en a plusieurs, et chacun a son prix", async ({ page }) => {
  const { slug, product } = await newShop(page);
  const panel = page.getByRole("region", { name: "Clients privilégiés" });
  await expect(panel).toContainText("Aucun : tous les vendeurs ont le même prix.");
  // No group, no privileged price field.
  await expect(page.getByRole("region", { name: "Ajouter une marchandise" }).getByText("Prix pour :")).toHaveCount(0);

  await panel.getByLabel("Nouveau groupe").fill("Citoyens de Blancherive");
  await panel.getByRole("button", { name: "Ajouter le groupe" }).click();
  await expect(panel.getByRole("status")).toContainText("Groupe « Citoyens de Blancherive » ajouté.");
  await panel.getByLabel("Nouveau groupe").fill("Compagnons");
  await panel.getByRole("button", { name: "Ajouter le groupe" }).click();
  await expect(panel.getByLabel("Nom du groupe Compagnons")).toBeVisible();
  // Two groups can't share a name.
  await panel.getByLabel("Nouveau groupe").fill("Compagnons");
  await panel.getByRole("button", { name: "Ajouter le groupe" }).click();
  await expect(panel.getByRole("alert")).toHaveText("La boutique a déjà un groupe à ce nom.");

  // Renamed, the group keeps its place.
  const renamed = panel.getByLabel("Nom du groupe Citoyens de Blancherive");
  await renamed.fill("Citoyens de Vendeaume");
  await panel.getByRole("form", { name: "Citoyens de Blancherive" }).getByRole("button", { name: "Renommer" }).click();
  await expect(panel.getByLabel("Nom du groupe Citoyens de Vendeaume")).toHaveValue("Citoyens de Vendeaume");

  // Each group has its price on the merchandise.
  await page.getByRole("link", { name: `Modifier ${product}` }).click();
  await expect(page.getByRole("heading", { name: product, level: 1 })).toBeVisible();
  await page.getByLabel("Prix pour : Citoyens de Vendeaume").fill("4");
  await page.getByLabel("Prix pour : Compagnons").fill("5");
  await page.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/marchandises$`));

  await page.goto(`/${slug}/tarifs`);
  // The leather is the featured product: a tile per group, before the others' price.
  const tiles = page.getByTestId("rachat-phare-privilegie");
  await expect(tiles).toHaveText(["Rachat · Citoyens de Vendeaume4 septims", "Rachat · Compagnons5 septims"]);

  await page.goto(`/${slug}/achat-vente/achat`);
  const purchase = page.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(purchase, product);
  await purchase.getByLabel("Quantité").fill("10");
  const amount = purchase.getByLabel("Montant (septims)");
  await expect(purchase.getByRole("radio")).toHaveCount(3);
  await expect(
    purchase.getByText("Citoyens de Vendeaume : 4 septims / unité · Compagnons : 5 septims / unité · autres vendeurs : 3 septims / unité"),
  ).toBeVisible();
  await expect(amount).toHaveValue("30");
  await purchase.getByRole("radio", { name: "Citoyens de Vendeaume" }).check();
  await expect(amount).toHaveValue("40");
  await purchase.getByRole("radio", { name: "Compagnons" }).check();
  await expect(amount).toHaveValue("50");
  await expect(purchase.getByTestId("tarif")).toContainText("prix privilégié : Compagnons");

  // Removing a group asks once more, then takes its prices away.
  await page.goto(`/${slug}/marchandises`);
  await panel.getByRole("button", { name: "Supprimer Compagnons" }).click();
  await panel.getByRole("button", { name: "Garder" }).click();
  await expect(panel.getByLabel("Nom du groupe Compagnons")).toBeVisible();
  await panel.getByRole("button", { name: "Supprimer Compagnons" }).click();
  await panel.getByRole("button", { name: "Supprimer le groupe et ses prix" }).click();
  await expect(panel.getByLabel("Nom du groupe Compagnons")).toHaveCount(0);
  await page.goto(`/${slug}/tarifs`);
  await expect(tiles).toHaveText(["Rachat · Citoyens de Vendeaume4 septims"]);
});

test("une boutique a cinq clients privilégiés au plus", async ({ page }) => {
  await newShop(page);
  const panel = page.getByRole("region", { name: "Clients privilégiés" });
  for (const name of ["Jarls", "Gardes", "Mages", "Bardes", "Voleurs"]) {
    await panel.getByLabel("Nouveau groupe").fill(name);
    await panel.getByRole("button", { name: "Ajouter le groupe" }).click();
    await expect(panel.getByLabel(`Nom du groupe ${name}`)).toBeVisible();
  }
  // The fifth one closes the addition.
  await expect(panel.getByLabel("Nouveau groupe")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Ajouter le groupe" })).toHaveCount(0);
});
