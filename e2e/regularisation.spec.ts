import { expect, test, type Locator, type Page } from "@playwright/test";
import postgres from "postgres";
import { GERANT, COMPTOIR, newEmployeePage, loginAsGerant, pickProduct, uniqueName } from "./helpers";

// Three screenshots of a chest in the game, taken while scrolling down: their
// lines overlap, and most items show on several lines (stolen or not).
const SCREENSHOTS = ["ScreenShot139.jpg", "ScreenShot138.jpg", "ScreenShot140.jpg"].map(
  (name) => `${__dirname}/fixtures/coffre/${name}`,
);

/**
 * A shop of its own, so that its merchandises can bear the game's names
 * without other tests touching their stock. Returns its address.
 */
async function shopWithStock(stock: Record<string, number>, aliases: Record<string, string> = {}) {
  const name = uniqueName("Coffre");
  const slug = name.toLowerCase();
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [shop] = await sql`insert into shops (name, slug) values (${name}, ${slug}) returning id`;
    await sql`
      insert into shop_members (shop_id, member_id, role)
      select ${shop.id}, id, 'gerant' from members where username = ${GERANT.username}`;
    const [category] = await sql`
      insert into product_categories (shop_id, name, hides) values (${shop.id}, 'Peaux', true) returning id`;
    for (const [product, units] of Object.entries(stock)) {
      await sql`
        insert into products (shop_id, name, category_id, unit, stock)
        values (${shop.id}, ${product}, ${category.id}, 'peau', ${units})`;
    }
    // Names of the game the shop retained before, as the app writes them: normalized.
    for (const [name, product] of Object.entries(aliases)) {
      await sql`
        insert into product_aliases (shop_id, name, product_id)
        select ${shop.id}, ${name}, id from products where shop_id = ${shop.id} and name = ${product}`;
    }
  } finally {
    await sql.end();
  }
  return `/${slug}`;
}

/** Writes the count, through the checks when the OCR was unsure of a number; then the answer shows. */
async function inscribe(review: Locator) {
  await review.getByRole("button", { name: "Mettre le stock à jour" }).click();
  const checks = review.getByRole("alert", { name: "À vérifier avant d'inscrire" });
  await expect(
    review.getByRole("alert").or(review.getByRole("status")).or(review.page().getByText(/^Mouvement de stock inscrit/)).first(),
  ).toBeVisible();
  if (await checks.isVisible()) await checks.getByRole("button", { name: "Inscrire quand même" }).click();
}

/** Gives the screenshots, once the page is ready to read them. */
async function upload(page: Page, files: string[]) {
  const field = page.getByLabel("Captures du coffre");
  await expect(field).toBeEnabled();
  await field.setInputFiles(files);
}

const fixtures = (...names: string[]) => names.map((name) => `${__dirname}/fixtures/coffre/ScreenShot${name}.jpg`);

test("un gérant compte un coffre depuis des captures du jeu, et l'app retient les noms du jeu", async ({ page }) => {
  test.setTimeout(240_000); // The screenshots are read in the browser.
  const shop = await shopWithStock({ Biche: 200, Loup: 188, Ours: 0, Cuir: 10, Renard: 34, Lapin: 7 });
  await loginAsGerant(page);
  await page.goto(`${shop}/inventaire`);
  await page.getByRole("link", { name: "Régulariser le stock" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Régulariser le stock" })).toBeVisible();

  // Given out of order: their names put them back in order.
  await upload(page, SCREENSHOTS);
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 180_000 });

  // The lines of an item add up, and those seen on two screenshots count once.
  const biche = review.getByRole("group", { name: "Peau de biche" });
  await expect(biche).toContainText("255 + 1");
  await expect(biche.getByLabel("Marchandise")).toHaveValue("Biche");
  await expect(biche.getByLabel("Compté")).toHaveValue("256");
  const loup = review.getByRole("group", { name: "Peau de loup", exact: true });
  await expect(loup).toContainText("186 + 1 + 1");
  await expect(loup.getByTestId("ecart")).toHaveText("=");
  await expect(review.getByRole("group", { name: "Peau d'ours", exact: true }).getByLabel("Compté")).toHaveValue("54");
  await expect(review.getByRole("group", { name: "Peau d'ours troglodyte" })).toContainText("72 + 1 + 1");

  // A name of the game the shop does not know yet is shown apart, ignored until tied to a merchandise.
  const unknown = review.getByRole("region", { name: "Objets non reconnus" });
  const known = review.getByRole("region", { name: "Objets reconnus" });
  await expect(unknown.getByRole("group", { name: "Deer Pelt" })).toBeVisible();
  await expect(unknown.getByRole("group", { name: "Leather" })).toBeVisible();
  await expect(known.getByRole("group", { name: "Peau de biche" })).toBeVisible();
  await expect(unknown.getByRole("group", { name: "Peau de biche" })).toHaveCount(0);
  const deer = unknown.getByRole("group", { name: "Deer Pelt" });
  await expect(deer.getByLabel("Marchandise")).toHaveValue("Ignorer");
  // Picked in the same merchandise picker as everywhere else.
  await pickProduct(deer, "Biche");
  await expect(deer.getByTestId("stock")).toHaveText("200");
  // Counted with the 256 Peau de biche: 270, so 70 more than in stock.
  await expect(deer.getByTestId("ecart")).toHaveText("+70*");
  // On a wide screen, the recognized items on the left and the others on their right, apart.
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(async () => {
    const left = (await known.boundingBox())!;
    const right = (await unknown.boundingBox())!;
    expect(right.x - (left.x + left.width)).toBeGreaterThanOrEqual(16);
    expect(Math.abs(right.y - left.y)).toBeLessThan(2);
  }).toPass();
  const leather = review.getByRole("group", { name: "Leather" });
  await pickProduct(leather, "Cuir");
  // A count can be corrected before it is written.
  await leather.getByLabel("Compté").fill("500");
  await review.getByRole("button", { name: "Mettre le stock à jour" }).click();
  // Big gaps are shown before anything is written.
  const checks = review.getByRole("alert", { name: "À vérifier avant d'inscrire" });
  await expect(checks).toContainText("Cuir : 10 en stock, 500 comptés.");
  await expect(checks).toContainText("Ours : 0 en stock, 54 comptés.");
  // A count the OCR was unsure of: "(53)".
  await expect(checks).toContainText("Peau d'ours : un nombre peut-être mal lu.");
  await expect(page).toHaveURL(new RegExp(`${shop}/inventaire/regularisation$`));
  await checks.getByRole("button", { name: "Inscrire quand même" }).click();

  // Stock movements, never a silent overwrite; Loup and Renard were right, and Lapin was not in the chest.
  await expect(page).toHaveURL(new RegExp(`${shop}/inventaire\\?inscrit=`));
  await expect(page.getByText(/^Mouvement de stock inscrit/)).toHaveText(
    "Mouvement de stock inscrit : +70 Biche, +490 Cuir, +54 Ours.",
  );
  await expect(page.getByText("Régularisation du stock").first()).toBeVisible();

  // The next count remembers Deer Pelt and Leather.
  await page.getByRole("link", { name: "Régulariser le stock" }).click();
  await upload(page, SCREENSHOTS.slice(1, 2));
  const again = page.getByRole("form", { name: "Relire le comptage" });
  await expect(again).toBeVisible({ timeout: 60_000 });
  const chosen = (item: string) => again.getByRole("group", { name: item }).getByLabel("Marchandise");
  await expect(chosen("Deer Pelt")).toHaveValue("Biche");
  await expect(chosen("Leather")).toHaveValue("Cuir");
  // Now known, they join the recognized items.
  await expect(again.getByRole("region", { name: "Objets reconnus" }).getByRole("group", { name: "Deer Pelt" })).toBeVisible();

  // Without the deer pelts, read on this screenshot alone, the chest changes nothing: no movement is written.
  await again.getByRole("group", { name: "Leather" }).getByLabel("Compté").fill("500");
  await pickProduct(again.getByRole("group", { name: "Deer Pelt" }), "Ignorer");
  await inscribe(again);
  await expect(again.getByRole("status")).toHaveText("Rien à changer : le stock correspond déjà au coffre.");
});

test("les mots longs de la colonne Type ne se collent pas aux objets sans nombre", async ({ page }) => {
  test.setTimeout(240_000); // Three screenshots read in the browser, beside other tests.
  // Tabs Nourriture and Ingrédients, whose Type column comes close to the names, then Divers.
  const shop = await shopWithStock(
    { "Chair de saumon": 500, Givreboise: 0, Lavande: 0, Loup: 0 },
    { "timber wolf peli": "Loup" },
  );
  await loginAsGerant(page);
  await page.goto(`${shop}/inventaire/regularisation`);
  await upload(page, ["ScreenShot149.jpg", "ScreenShot150.jpg", "ScreenShot153.jpg"].map((name) => `${__dirname}/fixtures/coffre/${name}`));
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 180_000 });

  // The single item and its stack are one item, with nothing of "Nourriture" or "Ingrédient" in its name.
  const saumon = review.getByRole("group", { name: /^Chair de saumon/ });
  await expect(saumon).toHaveCount(1);
  await expect(saumon).toHaveAccessibleName("Chair de saumon");
  await expect(saumon).toContainText("1 + 521");
  await expect(saumon.getByTestId("ecart")).toHaveText("+22");
  await expect(review.getByRole("group", { name: /^Givreboises/ })).toContainText("3 + 1");
  await expect(review.getByRole("group", { name: /^lavande/i }).getByLabel("Compté")).toHaveValue("2");
  await expect(review).not.toContainText(/\b(Nou|Ingr)/);
  // A name retained when it was read with a letter wrong is still known, read right.
  await expect(review.getByRole("group", { name: "Timber Wolf Pelt" }).getByLabel("Marchandise")).toHaveValue("Loup");
});

test("la relecture montre les lignes des captures, propose les noms approchants et crée les marchandises manquantes", async ({ page }) => {
  test.setTimeout(240_000);
  // A shop just opened: one merchandise of the chest, under a name close to the game's.
  const shop = await shopWithStock({ "Montain Lyon Pelt": 0 });
  await loginAsGerant(page);
  await page.goto(`${shop}/inventaire/regularisation`);
  // The « Tous » tab: 161 is missing, and 164 was taken after scrolling back up.
  await upload(page, fixtures("160", "162", "163", "164"));
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 180_000 });

  // A page missing between two screenshots of the same tab is pointed out.
  await expect(page.getByRole("status", { name: "À propos des captures" })).toContainText(
    "ScreenShot160.jpg et ScreenShot162.jpg n'ont aucune ligne en commun : une page manque peut-être",
  );
  // Lines seen again after scrolling back up count once; close names stay apart.
  const ours = review.getByRole("group", { name: "Peau d'ours", exact: true });
  await expect(ours).toContainText("66 + 1 + 1");
  await expect(review.getByRole("group", { name: "Lys des cimes jaune" })).toContainText("39 + 1");
  await expect(review.getByRole("group", { name: "Lys des cimes rouge" })).toContainText("1 + 1");

  // The lines an item was read from, cut from the screenshots; seeing them checks a doubtful count.
  await expect(ours.getByLabel("Compté")).toHaveAttribute("title", /mal lu/);
  await ours.getByRole("button", { name: /^Peau d'ours/ }).click();
  await expect(ours.getByLabel("Compté")).not.toHaveAttribute("title", /mal lu/);
  await expect(ours.getByRole("img", { name: /^Sur ScreenShot163\.jpg : Peau d'ours/ })).toHaveCount(3);

  // Many of an item nothing recognized: the closest name is proposed, to confirm.
  const lion = review.getByRole("region", { name: "Objets non reconnus" }).getByRole("group", { name: "Mountain Lion Pelt" });
  await expect(lion.getByLabel("Marchandise")).toHaveValue("Montain Lyon Pelt");
  await review.getByRole("button", { name: "Mettre le stock à jour" }).click();
  const checks = review.getByRole("alert", { name: "À vérifier avant d'inscrire" });
  await expect(checks).toContainText("Mountain Lion Pelt : rattaché à Montain Lyon Pelt par un nom approchant.");
  await checks.getByRole("button", { name: "Revenir à la relecture" }).click();
  await lion.getByRole("button", { name: "Proposée : confirmer" }).click();
  await expect(lion.getByRole("button", { name: "Proposée : confirmer" })).toHaveCount(0);

  // The others are created all at once, in one category; one is renamed, one left out.
  const unknown = review.getByRole("region", { name: "Objets non reconnus" });
  const createAll = unknown.getByRole("button", { name: /^Créer les \d+ ignorés dans cette catégorie$/ });
  await createAll.click();
  const eye = unknown.getByRole("group", { name: "Oeil de smilodon" });
  await expect(eye.getByLabel("Marchandise")).toHaveValue("Nouvelle marchandise");
  // Undone as fast, then done again.
  await unknown.getByRole("button", { name: /^Ne plus créer les \d+ nouvelles$/ }).click();
  await expect(eye.getByLabel("Marchandise")).toHaveValue("Ignorer");
  await createAll.click();
  await expect(eye.getByLabel("Marchandise")).toHaveValue("Nouvelle marchandise");
  await eye.getByLabel("Nom").fill("Œil de smilodon");
  await pickProduct(unknown.getByRole("group", { name: "Leg of Gout" }), "Ignorer");
  await inscribe(review);

  await expect(page).toHaveURL(new RegExp(`${shop}/inventaire\\?inscrit=`));
  const written = page.getByText(/^Mouvement de stock inscrit/);
  await expect(written).toContainText("+30 Montain Lyon Pelt");
  await expect(written).toContainText("+2 Œil de smilodon");
  await expect(written).toContainText("+705 Leather");
  await expect(written).not.toContainText("Leg of");
});

test("une nouvelle marchandise au nom d'une archivée est refusée, et rien n'est inscrit", async ({ page }) => {
  test.setTimeout(240_000);
  const shop = await shopWithStock({ Leather: 0, Biche: 0 });
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  await sql`update products set archived = true where name = 'Leather' and shop_id = (select id from shops where slug = ${shop.slice(1)})`;
  await sql.end();
  await loginAsGerant(page);
  await page.goto(`${shop}/inventaire/regularisation`);
  await upload(page, SCREENSHOTS.slice(1, 2));
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 180_000 });
  await pickProduct(review.getByRole("group", { name: "Leather" }), "Nouvelle marchandise");
  await inscribe(review);
  await expect(review.getByRole("alert").last()).toHaveText(
    "Il y a déjà une marchandise à ce nom. Elle est peut-être archivée : regarde dans « Gérer les marchandises ».",
  );
  await expect(page).toHaveURL(new RegExp(`${shop}/inventaire/regularisation$`));

  // Created at 0, a merchandise has no movement; written again, it is not created twice.
  await pickProduct(review.getByRole("group", { name: "Leather" }), "Ignorer");
  const deer = review.getByRole("group", { name: "Deer Pelt" });
  await pickProduct(deer, "Nouvelle marchandise");
  await deer.getByLabel("Compté").fill("0");
  await inscribe(review);
  await expect(review.getByRole("status")).toHaveText("1 marchandise créée, sans stock : rien d'autre à changer.");
  await expect(deer.getByLabel("Marchandise")).toHaveValue("Deer Pelt");
  await inscribe(review);
  await expect(review.getByRole("status")).toHaveText("Rien à changer : le stock correspond déjà au coffre.");
});

test("un employé ne compte pas le stock depuis le jeu", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "frida");
  await page.goto(`${COMPTOIR}/inventaire`);
  await expect(page.getByRole("link", { name: "Mouvement de stock" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Régulariser le stock" })).toHaveCount(0);
  await page.goto(`${COMPTOIR}/inventaire/regularisation`);
  await expect(page.getByRole("heading", { level: 1, name: "Régulariser le stock" })).toHaveCount(0);
});

test("au téléphone, la relecture du comptage tient dans l'écran", async ({ browser }) => {
  test.slow();
  const shop = await shopWithStock({ Biche: 3 });
  const page = await (await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true })).newPage();
  // Fonts a bit wider than this machine's, as on the CI.
  await page.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => document.documentElement.style.setProperty("letter-spacing", "0.03em")),
  );
  await loginAsGerant(page);
  await page.goto(`${shop}/inventaire`);
  await page.getByRole("link", { name: "Régulariser le stock" }).click();
  await upload(page, SCREENSHOTS.slice(0, 1));
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 180_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // The merchandise and its count side by side, apart.
  const item = review.getByRole("group", { name: "Peau de biche" });
  const product = await item.getByLabel("Marchandise").boundingBox();
  const counted = await item.getByLabel("Compté").boundingBox();
  expect(counted!.x - (product!.x + product!.width)).toBeGreaterThanOrEqual(8);
  await page.screenshot({ path: "test-results/regularisation-320.png", fullPage: true });
});
