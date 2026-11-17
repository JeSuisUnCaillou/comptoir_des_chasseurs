import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COMPTOIR, loginAsGerant, newEmployeePage, openShop, uniqueName } from "./helpers";

const setup = (page: Page) => page.getByRole("region", { name: "Initialiser la boutique" });

test("le gérant d'une nouvelle boutique l'initialise : sa caisse, puis son stock depuis des captures", async ({ page }) => {
  test.setTimeout(240_000); // The screenshot is read in the browser.
  const shop = await openShop(page, uniqueName("Comptoir de Morthal"));
  await expect(page.getByRole("heading", { level: 1, name: "Grand livre" })).toBeVisible();

  // Step 1: what the till holds, written as a cash movement in.
  const till = setup(page).getByRole("listitem", { name: "Étape 1 : la caisse" });
  await till.getByLabel("Septims dans la caisse").fill("250");
  await till.getByRole("button", { name: "Mettre en caisse" }).click();
  await expect(till.getByRole("status")).toHaveText("Fait : la caisse de départ est inscrite au registre.");
  await expect(till.getByLabel("Septims dans la caisse")).toHaveCount(0);
  // In the register, and in the till.
  await expect(page.getByText("Caisse de départ", { exact: true })).toBeVisible();
  await expect(page.getByTestId("caisse-totale")).toContainText("250");

  // Step 2: the stock, imported from a chest of the game.
  await setup(page).getByRole("link", { name: "Importer le stock" }).click();
  await expect(page).toHaveURL(`${shop}/inventaire/regularisation`);
  const dir = mkdtempSync(join(tmpdir(), "coffre-"));
  const screenshot = join(dir, "ScreenShot138.jpg");
  copyFileSync(`${__dirname}/fixtures/coffre/ScreenShot138.jpg`, screenshot);
  const field = page.getByLabel("Captures du coffre");
  await expect(field).toBeEnabled();
  await field.setInputFiles(screenshot);
  const review = page.getByRole("form", { name: "Relire le comptage" });
  await expect(review).toBeVisible({ timeout: 180_000 });
  // Nothing is known yet: every item becomes a new merchandise.
  await review
    .getByRole("region", { name: "Objets non reconnus" })
    .getByRole("button", { name: /^Créer les \d+ ignorés dans cette catégorie$/ })
    .click();
  await review.getByRole("button", { name: "Mettre le stock à jour" }).click();
  const checks = review.getByRole("alert", { name: "À vérifier avant d'inscrire" });
  const written = page.getByText(/^Mouvement de stock inscrit/);
  await expect(checks.or(written)).toBeVisible();
  if (await checks.isVisible()) await checks.getByRole("button", { name: "Inscrire quand même" }).click();
  await expect(written).toBeVisible();

  // Set up: the Grand livre no longer offers it.
  await page.goto(shop);
  await expect(page.getByRole("heading", { level: 1, name: "Grand livre" })).toBeVisible();
  await expect(setup(page)).toHaveCount(0);
});

test("le gérant peut passer l'initialisation, qui n'est plus proposée", async ({ page }) => {
  const shop = await openShop(page, uniqueName("Échoppe de Rorikbourg"));
  await expect(setup(page)).toBeVisible();
  await setup(page).getByRole("button", { name: "Passer l'initialisation" }).click();
  await expect(setup(page)).toHaveCount(0);
  await page.goto(shop);
  await expect(page.getByRole("heading", { level: 1, name: "Grand livre" })).toBeVisible();
  await expect(setup(page)).toHaveCount(0);
});

test("le comptoir ne propose pas l'initialisation", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto(COMPTOIR);
  await expect(page.getByRole("heading", { level: 1, name: "Grand livre" })).toBeVisible();
  await expect(setup(page)).toHaveCount(0);
});

test("un employé d'une nouvelle boutique ne voit pas l'initialisation", async ({ page, browser }) => {
  const shop = await openShop(page, uniqueName("Étal de Pierre-Blanche"));
  await expect(setup(page)).toBeVisible();
  const employee = await newEmployeePage(browser, "brenuin");
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into shop_members (shop_id, member_id, role)
      select s.id, m.id, 'employe' from shops s, members m
      where s.slug = ${shop.slice(1)} and m.username = ${employee.username}`;
  } finally {
    await sql.end();
  }
  await employee.page.goto(shop);
  await expect(employee.page.getByRole("heading", { level: 1, name: "Grand livre" })).toBeVisible();
  await expect(setup(employee.page)).toHaveCount(0);
});
