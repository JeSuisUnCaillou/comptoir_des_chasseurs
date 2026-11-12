import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { ALERT, createProduct, newEmployeePage, pickProduct, uniqueName } from "./helpers";

/** Sets a product's stock straight in the database, as a sale made meanwhile would. */
async function setStock(name: string, stock: number) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update products set stock = ${stock} where shop_id = 1 and name = ${name}`;
  } finally {
    await sql.end();
  }
}

test("un mouvement de stock fait entrer plusieurs marchandises d'un coup, sans septims", async ({ browser }) => {
  const hide = uniqueName("Peau de loup");
  const leather = uniqueName("Cuir");
  await createProduct(hide, { stock: 0 });
  await createProduct(leather, { stock: 4, unit: "cuir", category: "cuir" });
  const reason = uniqueName("Chasse");
  const { page, username } = await newEmployeePage(browser, "chasseur");

  // From the Grand livre, next to the cash movement.
  await page.getByRole("link", { name: "Mouvement de stock" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mouvement de stock" })).toBeVisible();
  const form = page.getByRole("region", { name: "Inscrire un mouvement de stock" });
  await form.getByRole("radio", { name: "Entrée en stock" }).check();
  const first = form.getByRole("group", { name: "Marchandise 1" });
  await pickProduct(first, hide, "Marchandise");
  await first.getByLabel("Quantité").fill("5");
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  const second = form.getByRole("group", { name: "Marchandise 2" });
  await pickProduct(second, leather, "Marchandise");
  await second.getByLabel("Quantité").fill("3");
  await expect(second.getByTestId("stock-dispo")).toHaveText("En stock : 4 cuirs → après : 7");
  await form.getByLabel("Motif").fill(reason);
  // No septims anywhere on the form.
  await expect(form).not.toContainText("septim");
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();

  // Back on the Inventaire, which confirms it and shows it as one card.
  await expect(page).toHaveURL(/\/inventaire\?inscrit=\d+,\d+$/);
  await expect(page.getByRole("status")).toHaveText(`Mouvement de stock inscrit : +5 ${hide}, +3 ${leather}.`);
  const rows = page.getByTestId("historique").locator("tr.fresh");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(new RegExp(`${leather}.*\\+3.*7 cuirs.*${reason}`));
  await expect(rows.last()).toContainText(new RegExp(`${hide}.*\\+5.*5 peaux`));
  await expect(rows.first()).toHaveClass(/entry-first/);
  await expect(rows.last()).toHaveClass(/entry-next/);
  await expect(rows.last()).toHaveClass(/entry-last/);
  await page.getByLabel("Rechercher une marchandise").fill(hide);
  await expect(page.getByTestId(`stock-${hide}`).getByTestId("stock-value")).toHaveText("5");

  // The member's activity shows it as one stock entry, with no money.
  await page.getByTestId("member-name").click();
  await expect(page.getByRole("heading", { level: 1, name: username })).toBeVisible();
  const lines = page.getByTestId("activite").locator("tbody tr");
  await expect(lines).toHaveCount(2);
  await expect(lines.first()).toContainText(new RegExp(`Stock.*${leather}.*\\+3.*—.*${reason}`));
  await expect(lines.last()).toContainText(new RegExp(`${hide}.*\\+5.*—`));
  await expect(lines.first()).toHaveClass(/entry-first/);
  await expect(lines.last()).toHaveClass(/entry-last/);
});

test("une sortie de stock de plusieurs marchandises s'inscrit entière ou pas du tout", async ({ browser }) => {
  const hide = uniqueName("Peau de sabrecat");
  const meat = uniqueName("Viande");
  await createProduct(hide, { stock: 2 });
  await createProduct(meat, { stock: 5, unit: "morceau", category: "viande" });
  const { page } = await newEmployeePage(browser, "boucher");

  // From the Inventaire.
  await page.goto("/inventaire");
  await page.getByRole("link", { name: "Mouvement de stock" }).click();
  const form = page.getByRole("region", { name: "Inscrire un mouvement de stock" });
  await form.getByRole("radio", { name: "Sortie de stock" }).check();
  const first = form.getByRole("group", { name: "Marchandise 1" });
  await pickProduct(first, hide, "Marchandise");
  await first.getByLabel("Quantité").fill("1");
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  const second = form.getByRole("group", { name: "Marchandise 2" });
  await pickProduct(second, meat, "Marchandise");
  await second.getByLabel("Quantité").fill("9");
  await form.getByLabel("Motif").fill("Transformation en cuir");

  // More than the stock: said on the spot, and the form waits.
  await expect(form.locator(ALERT)).toHaveText(`Stock insuffisant de ${meat} : il ne reste que 5 morceaux.`);
  const submit = form.getByRole("button", { name: "Inscrire le mouvement" });
  await expect(submit).toBeDisabled();

  // Within the stock shown, but a sale took some meanwhile: nothing is written.
  await second.getByLabel("Quantité").fill("4");
  await expect(second.getByTestId("stock-dispo")).toHaveText("En stock : 5 morceaux → après : 1");
  await setStock(meat, 2);
  await submit.click();
  await expect(form.locator(ALERT)).toHaveText("Marchandise 2 : Stock insuffisant pour cette sortie.");
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(hide);
  await expect(page.getByTestId(`stock-${hide}`).getByTestId("stock-value")).toHaveText("2");
  // No movement of that hide in the history.
  await page.goto(`/inventaire?q=${encodeURIComponent(hide)}`);
  await expect(page.getByText("Aucun mouvement ne correspond.")).toBeVisible();
});

test("les mouvements d'une vente de plusieurs lignes restent une ligne chacun dans l'historique", async ({ browser }) => {
  const fox = uniqueName("Renard");
  const wolf = uniqueName("Loup");
  await createProduct(fox, { stock: 5 });
  await createProduct(wolf, { stock: 5 });
  const { page } = await newEmployeePage(browser, "vendeur");

  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form.getByRole("group", { name: "Marchandise 1" }), fox);
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(form.getByRole("group", { name: "Marchandise 2" }), wolf);
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page).toHaveURL(/\/achat-vente\?inscrit=\d+,\d+$/);

  // The sale is one entry of the register; its stock movements are not grouped by hand.
  await page.goto("/inventaire");
  for (const name of [fox, wolf]) {
    const row = page.getByTestId("historique").getByRole("row").filter({ hasText: name });
    await expect(row).toHaveClass(/\bentry-first\b.*\bentry-last\b/);
    await expect(row.locator(".sr-only")).toHaveCount(0);
  }
});
