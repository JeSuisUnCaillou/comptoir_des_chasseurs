import { expect, test } from "@playwright/test";
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

test("un gérant compte un coffre depuis des captures du jeu, et l'app retient les noms du jeu", async ({ page }) => {
  test.slow(); // The screenshots are read in the browser.
  const shop = await shopWithStock({ Biche: 200, Loup: 188, Ours: 0, Cuir: 10, Renard: 34, Lapin: 7 });
  await loginAsGerant(page);
  await page.goto(`${shop}/inventaire`);
  await page.getByRole("link", { name: "Régulariser le stock" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Régulariser le stock" })).toBeVisible();

  // Given out of order: their names put them back in order.
  await page.getByLabel("Captures du coffre").setInputFiles(SCREENSHOTS);
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 90_000 });

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

  // Stock movements, never a silent overwrite; Loup and Renard were right, and Lapin was not in the chest.
  await expect(page).toHaveURL(new RegExp(`${shop}/inventaire\\?inscrit=`));
  await expect(page.getByText(/^Mouvement de stock inscrit/)).toHaveText(
    "Mouvement de stock inscrit : +70 Biche, +490 Cuir, +54 Ours.",
  );
  await expect(page.getByText("Régularisation du stock").first()).toBeVisible();

  // The next count remembers Deer Pelt and Leather.
  await page.getByRole("link", { name: "Régulariser le stock" }).click();
  await page.getByLabel("Captures du coffre").setInputFiles(SCREENSHOTS.slice(1, 2));
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
  await again.getByRole("button", { name: "Mettre le stock à jour" }).click();
  await expect(again.getByRole("status")).toHaveText("Rien à changer : le stock correspond déjà au coffre.");
});

test("les mots longs de la colonne Type ne se collent pas aux objets sans nombre", async ({ page }) => {
  test.slow();
  // Tabs Nourriture and Ingrédients, whose Type column comes close to the names, then Divers.
  const shop = await shopWithStock(
    { "Chair de saumon": 500, Givreboise: 0, Lavande: 0, Loup: 0 },
    { "timber wolf peli": "Loup" },
  );
  await loginAsGerant(page);
  await page.goto(`${shop}/inventaire/regularisation`);
  await page
    .getByLabel("Captures du coffre")
    .setInputFiles(["ScreenShot149.jpg", "ScreenShot150.jpg", "ScreenShot153.jpg"].map((name) => `${__dirname}/fixtures/coffre/${name}`));
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 90_000 });

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
  await page.getByLabel("Captures du coffre").setInputFiles(SCREENSHOTS.slice(0, 1));
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // The merchandise and its count side by side, apart.
  const item = review.getByRole("group", { name: "Peau de biche" });
  const product = await item.getByLabel("Marchandise").boundingBox();
  const counted = await item.getByLabel("Compté").boundingBox();
  expect(counted!.x - (product!.x + product!.width)).toBeGreaterThanOrEqual(8);
  await page.screenshot({ path: "test-results/regularisation-320.png", fullPage: true });
});
