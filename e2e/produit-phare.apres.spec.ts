import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { createProduct, loginAsGerant, pickProduct, uniqueName } from "./helpers";

// These tests change the same setting: one after the other.
test.describe.configure({ mode: "serial" });

async function withDb(run: (sql: postgres.Sql) => Promise<unknown>) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await run(sql);
  } finally {
    await sql.end();
  }
}

/** Puts the leather alone on top of the Tarifs again, as the tests found it. */
function leatherAlone() {
  return withDb((sql) => sql`update products set featured_at = case when name = 'Cuir' then now() end`);
}

function featuredPanel(page: Page) {
  return page.getByRole("region", { name: "Produits phares" });
}

/** Adds a product to the featured ones in Gérer les marchandises. */
async function add(page: Page, name: string) {
  await page.goto("/marchandises");
  const panel = featuredPanel(page);
  // The usual picker: typed, then chosen in its list.
  await pickProduct(panel, name, "Ajouter un produit phare");
  await panel.getByRole("button", { name: "Ajouter" }).click();
  await expect(panel.getByRole("list", { name: "Produits phares actuels" })).toContainText(name);
}

/** Takes a product back from the featured ones in Gérer les marchandises. */
async function remove(page: Page, name: string) {
  await page.goto("/marchandises");
  const panel = featuredPanel(page);
  await panel.getByRole("button", { name: `Retirer ${name}` }).click();
  await expect(panel.getByRole("button", { name: `Retirer ${name}` })).toHaveCount(0);
}

const calculatorProduct = (page: Page) => page.getByTestId("calculateur").getByRole("combobox", { name: "Marchandise" });

test("un gérant met plusieurs produits phares en haut des Tarifs, une ligne chacun", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/tarifs");
  // The pencil on the block leads to the setting.
  await featuredPanel(page).getByRole("link", { name: "Gérer les produits phares" }).click();
  await expect(page).toHaveURL(/\/marchandises#phare$/);
  // The leather until a gérant chooses others.
  await expect(featuredPanel(page).getByRole("list", { name: "Produits phares actuels" })).toHaveText("Cuir");

  try {
    await add(page, "Venaison");
    await add(page, "Flèches d'acier");
    await page.goto("/tarifs");
    const cards = featuredPanel(page).getByRole("region");
    await expect(cards.getByRole("heading", { level: 3 })).toHaveText(["Cuir", "Venaison", "Flèches d'acier"]);
    // One line each, one under the other, beside the calculator.
    const rows = await Promise.all([0, 1, 2].map(async (i) => (await cards.nth(i).boundingBox())!));
    expect(rows[1].y).toBeGreaterThanOrEqual(rows[0].y + rows[0].height);
    expect(rows[2].y).toBeGreaterThanOrEqual(rows[1].y + rows[1].height);
    const calc = (await page.getByRole("region", { name: "Calculateur des prix" }).boundingBox())!;
    expect(rows[0].x + rows[0].width).toBeLessThan(calc.x);
    const venison = page.getByRole("region", { name: "Venaison", exact: true });
    await expect(venison.locator(".stat").filter({ hasText: "Rachat" })).toHaveCount(1);
    await expect(venison.locator(".stat").filter({ hasText: "Vente" })).toHaveCount(1);
    // The blacksmith's price is only the leather's.
    await expect(venison).not.toContainText("forgeron");
    await expect(page.getByRole("region", { name: "Cuir", exact: true })).toContainText("Rachat par le forgeron");
    // The calculator starts on the first; the grids leave them all out.
    await expect(calculatorProduct(page)).toHaveValue("Cuir");
    await expect(page.getByRole("region", { name: "Viandes et venaison" }).getByRole("row", { name: /^Venaison/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Autres ressources" }).getByRole("row", { name: /Flèches d'acier/ })).toHaveCount(0);

    // Reordered in Gérer les marchandises by dragging a product by its handle, then with the keyboard.
    await page.goto("/marchandises");
    const list = featuredPanel(page).getByRole("list", { name: "Produits phares actuels" });
    const handle = (name: string) => list.getByRole("button", { name: `Déplacer ${name}` });
    // Saved: a fresh page shows the same order, once the save has reached the server.
    const saved = (names: string[]) =>
      expect(async () => {
        await page.reload();
        await expect(list.getByRole("listitem")).toHaveText(names, { timeout: 1000 });
      }).toPass();
    await handle("Flèches d'acier").dragTo(list.getByRole("listitem").filter({ hasText: "Cuir" }));
    await expect(list.getByRole("listitem")).toHaveText(["Flèches d'acier", "Cuir", "Venaison"]);
    await saved(["Flèches d'acier", "Cuir", "Venaison"]);
    await handle("Venaison").focus();
    await page.keyboard.press("ArrowUp");
    await expect(list.getByRole("listitem")).toHaveText(["Flèches d'acier", "Venaison", "Cuir"]);
    await expect(handle("Venaison")).toBeFocused();
    await saved(["Flèches d'acier", "Venaison", "Cuir"]);
    await handle("Venaison").focus();
    await page.keyboard.press("ArrowDown");
    await expect(list.getByRole("listitem")).toHaveText(["Flèches d'acier", "Cuir", "Venaison"]);
    await saved(["Flèches d'acier", "Cuir", "Venaison"]);
    await page.goto("/tarifs");
    await expect(featuredPanel(page).getByRole("heading", { level: 3 })).toHaveText(["Flèches d'acier", "Cuir", "Venaison"]);
    await expect(calculatorProduct(page)).toHaveValue("Flèches d'acier");

    // Taken back, the leather returns to its grid, and the others keep their order.
    await remove(page, "Cuir");
    await page.goto("/tarifs");
    await expect(featuredPanel(page).getByRole("heading", { level: 3 })).toHaveText(["Flèches d'acier", "Venaison"]);
    await expect(calculatorProduct(page)).toHaveValue("Flèches d'acier");
    await expect(page.getByRole("region", { name: "Autres ressources" }).getByRole("row").filter({ has: page.getByText("Cuir", { exact: true }) })).toBeVisible();

    // None left: the block says so.
    await remove(page, "Venaison");
    await remove(page, "Flèches d'acier");
    await expect(featuredPanel(page)).toContainText("Aucun produit phare.");
    await page.goto("/tarifs");
    await expect(featuredPanel(page)).toContainText("Aucun produit phare. Un gérant les choisit dans Gérer les marchandises.");
    await expect(page.getByRole("region", { name: "Viandes et venaison" }).getByRole("row", { name: /^Venaison/ })).toBeVisible();
  } finally {
    await leatherAlone();
  }
});

test("un produit phare archivé quitte le haut des Tarifs", async ({ page }) => {
  const name = uniqueName("Défense de mammouth");
  await createProduct(name, { category: "Autres ressources", unit: "pièce" });
  await loginAsGerant(page);
  try {
    await add(page, name);
    await page.goto("/tarifs");
    await expect(featuredPanel(page).getByRole("region", { name, exact: true })).toBeVisible();

    await withDb((sql) => sql`update products set archived = true where name = ${name}`);
    await page.goto("/tarifs");
    await expect(featuredPanel(page).getByRole("heading", { level: 3 })).toHaveText(["Cuir"]);
    await page.goto("/marchandises");
    await expect(featuredPanel(page).getByRole("list", { name: "Produits phares actuels" })).toHaveText("Cuir");
  } finally {
    await leatherAlone();
  }
});
