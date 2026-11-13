import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { createProduct, loginAsGerant, uniqueName } from "./helpers";

// Both tests change the same setting: one after the other.
test.describe.configure({ mode: "serial" });

/** Picks the featured product in Gérer les marchandises and saves it. */
async function feature(page: Page, name: string) {
  await page.goto("/marchandises");
  const panel = page.getByRole("region", { name: "Produit phare" });
  await panel.getByLabel("Produit phare").selectOption({ label: name });
  await panel.getByRole("button", { name: "Enregistrer" }).click();
  await expect(panel).toContainText(`Actuel : ${name}.`);
}

test("un gérant choisit le produit phare mis en avant en haut des Tarifs", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/marchandises");
  // The leather until a gérant chooses another.
  const panel = page.getByRole("region", { name: "Produit phare" });
  await expect(panel).toContainText("Actuel : Cuir.");
  await expect(panel.getByLabel("Produit phare").locator("option:checked")).toHaveText("Cuir");

  try {
    await feature(page, "Venaison");
    await page.goto("/tarifs");
    const top = page.getByRole("region", { name: "Venaison", exact: true });
    await expect(top).toContainText("Produit phare");
    await expect(top.locator(".stat").filter({ hasText: "Rachat" })).toHaveCount(1);
    await expect(top.locator(".stat").filter({ hasText: "Vente" })).toHaveCount(1);
    // The blacksmith's price is only the leather's.
    await expect(top).not.toContainText("forgeron");
    // The calculator starts on it; the grids leave it out, and the leather joins them.
    await expect(page.getByTestId("calculateur").getByRole("combobox", { name: "Marchandise" })).toHaveValue("Venaison");
    await expect(page.getByRole("region", { name: "Viandes et venaison" }).getByRole("row", { name: /^Venaison/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Autres ressources" }).getByRole("row").filter({ has: page.getByText("Cuir", { exact: true }) })).toBeVisible();
    await expect(page.getByRole("region", { name: "Cuir", exact: true })).toHaveCount(0);
  } finally {
    await feature(page, "Cuir");
  }

  await page.goto("/tarifs");
  const leather = page.getByRole("region", { name: "Cuir", exact: true });
  await expect(leather).toContainText("Rachat par le forgeron");
  await expect(page.getByRole("region", { name: "Viandes et venaison" }).getByRole("row", { name: /^Venaison/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Autres ressources" }).getByRole("row").filter({ has: page.getByText("Cuir", { exact: true }) })).toHaveCount(0);
});

test("un produit phare archivé laisse la place au cuir", async ({ page }) => {
  const name = uniqueName("Défense de mammouth");
  await createProduct(name, { category: "Autres ressources", unit: "pièce" });
  await loginAsGerant(page);
  try {
    await feature(page, name);
    await page.goto("/tarifs");
    await expect(page.getByRole("region", { name, exact: true })).toContainText("Produit phare");

    const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
    try {
      await sql`update products set archived = true where name = ${name}`;
    } finally {
      await sql.end();
    }
    await page.goto("/tarifs");
    await expect(page.getByRole("region", { name: "Cuir", exact: true })).toContainText("Rachat par le forgeron");
    await expect(page.getByTestId("calculateur").getByRole("combobox", { name: "Marchandise" })).toHaveValue("Cuir");
  } finally {
    await feature(page, "Cuir");
  }
});
