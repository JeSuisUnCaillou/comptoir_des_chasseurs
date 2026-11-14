import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { GERANT, COMPTOIR, newEmployeePage, loginAsGerant, uniqueName } from "./helpers";

// Three screenshots of a chest in the game, taken while scrolling down: their
// lines overlap, and most items show on several lines (stolen or not).
const SCREENSHOTS = ["ScreenShot139.jpg", "ScreenShot138.jpg", "ScreenShot140.jpg"].map(
  (name) => `${__dirname}/fixtures/coffre/${name}`,
);

/**
 * A shop of its own, so that its merchandises can bear the game's names
 * without other tests touching their stock. Returns its address.
 */
async function shopWithStock(stock: Record<string, number>) {
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
  await page.getByRole("link", { name: "Compter depuis le jeu" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Compter depuis le jeu" })).toBeVisible();

  // Given out of order: their names put them back in order.
  await page.getByLabel("Captures du coffre").setInputFiles(SCREENSHOTS);
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 90_000 });

  // The lines of an item add up, and those seen on two screenshots count once.
  const biche = review.getByRole("group", { name: "Peau de biche" });
  await expect(biche).toContainText("lu : 255 + 1");
  await expect(biche.getByLabel("Marchandise")).toHaveValue(/\d+/);
  await expect(biche.getByLabel("Compté")).toHaveValue("256");
  const loup = review.getByRole("group", { name: "Peau de loup", exact: true });
  await expect(loup).toContainText("lu : 186 + 1 + 1");
  await expect(loup.getByTestId("ecart")).toContainText("aucun écart");
  await expect(review.getByRole("group", { name: "Peau d'ours", exact: true }).getByLabel("Compté")).toHaveValue("54");
  await expect(review.getByRole("group", { name: "Peau d'ours troglodyte" })).toContainText("lu : 72 + 1 + 1");

  // A name of the game the shop does not know yet is ignored until tied to a merchandise.
  const deer = review.getByRole("group", { name: "Deer Pelt" });
  await expect(deer.getByLabel("Marchandise")).toHaveValue("");
  await deer.getByLabel("Marchandise").selectOption({ label: "Biche" });
  await expect(deer.getByTestId("ecart")).toContainText("En stock : 200 → compté : 270");
  await expect(deer.getByTestId("ecart")).toContainText("+70 peaux");
  const leather = review.getByRole("group", { name: "Leather" });
  await leather.getByLabel("Marchandise").selectOption({ label: "Cuir" });
  // A count can be corrected before it is written.
  await leather.getByLabel("Compté").fill("500");
  await review.getByRole("button", { name: "Mettre le stock à jour" }).click();

  // Stock movements, never a silent overwrite; Loup and Renard were right, and Lapin was not in the chest.
  await expect(page).toHaveURL(new RegExp(`${shop}/inventaire\\?inscrit=`));
  await expect(page.getByText(/^Mouvement de stock inscrit/)).toHaveText(
    "Mouvement de stock inscrit : +70 Biche, +490 Cuir, +54 Ours.",
  );
  await expect(page.getByText("Comptage du coffre").first()).toBeVisible();

  // The next count remembers Deer Pelt and Leather.
  await page.getByRole("link", { name: "Compter depuis le jeu" }).click();
  await page.getByLabel("Captures du coffre").setInputFiles(SCREENSHOTS.slice(1, 2));
  const again = page.getByRole("form", { name: "Relire le comptage" });
  await expect(again).toBeVisible({ timeout: 60_000 });
  const chosen = (item: string) => again.getByRole("group", { name: item }).getByLabel("Marchandise").locator("option:checked");
  await expect(chosen("Deer Pelt")).toHaveText("Biche");
  await expect(chosen("Leather")).toHaveText("Cuir");
});

test("un employé ne compte pas le stock depuis le jeu", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "frida");
  await page.goto(`${COMPTOIR}/inventaire`);
  await expect(page.getByRole("link", { name: "Mouvement de stock" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Compter depuis le jeu" })).toHaveCount(0);
  await page.goto(`${COMPTOIR}/inventaire/comptage`);
  await expect(page.getByRole("heading", { level: 1, name: "Compter depuis le jeu" })).toHaveCount(0);
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
  await page.getByRole("link", { name: "Compter depuis le jeu" }).click();
  await page.getByLabel("Captures du coffre").setInputFiles(SCREENSHOTS.slice(0, 1));
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // The merchandise and its count side by side, apart.
  const item = review.getByRole("group", { name: "Peau de biche" });
  const product = await item.getByLabel("Marchandise").boundingBox();
  const counted = await item.getByLabel("Compté").boundingBox();
  expect(counted!.x - (product!.x + product!.width)).toBeGreaterThanOrEqual(8);
  await page.screenshot({ path: "test-results/comptage-320.png", fullPage: true });
});
