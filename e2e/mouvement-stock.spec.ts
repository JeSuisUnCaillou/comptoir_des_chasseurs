import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import {
  ALERT,
  createProduct,
  createStockMovement,
  GERANT,
  loginAsGerant,
  newEmployeePage,
  pickProduct,
  uniqueName,
} from "./helpers";

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
  await createProduct(leather, { stock: 4, unit: "cuir", category: "Autres ressources", leather: true });
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
  await createProduct(meat, { stock: 5, unit: "morceau", category: "Viandes et venaison" });
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

test("dans le choix d'une marchandise, Tab prend le premier résultat, ou garde ce qui a été tapé", async ({ browser }) => {
  const hide = uniqueName("Peau de lynx");
  await createProduct(hide, { stock: 6 });
  const { page } = await newEmployeePage(browser, "tabeur");
  await page.getByRole("link", { name: "Mouvement de stock" }).click();
  const form = page.getByRole("region", { name: "Inscrire un mouvement de stock" });
  const line = form.getByRole("group", { name: "Marchandise 1" });
  const box = line.getByRole("combobox", { name: "Marchandise" });

  // Click, type a word, Tab: the first result is chosen and the next field has the focus.
  await box.click();
  await box.pressSequentially(hide.slice(-5));
  await box.press("Tab");
  await expect(box).toHaveValue(hide);
  await expect(line.getByLabel("Quantité")).toBeFocused();
  await expect(line.getByTestId("stock-dispo")).toContainText("En stock : 6 peaux");

  // With the arrows, Tab takes the highlighted result instead of the first.
  const other = uniqueName("Peau de lynx");
  await createProduct(other, { stock: 2 });
  await page.reload();
  await box.click();
  await box.pressSequentially("Peau de lynx-");
  await expect(page.getByRole("option", { name: hide, exact: true })).toBeVisible();
  const second = await page.getByRole("option").nth(1).textContent();
  await box.press("ArrowDown");
  await box.press("Tab");
  await expect(box).toHaveValue(second!);

  // Nothing matches: the typed text stays, and the form is not sent until a merchandise is chosen.
  await box.click();
  await box.pressSequentially("zzzz introuvable");
  await box.press("Tab");
  await expect(box).toHaveValue("zzzz introuvable");
  expect(await box.evaluate((el: HTMLInputElement) => el.validationMessage)).toBe("Choisis une marchandise de la liste.");
  await form.getByRole("radio", { name: "Entrée en stock" }).check();
  await form.getByLabel("Motif").fill("Essai");
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page).toHaveURL(/\/inventaire\/mouvement$/);
  await pickProduct(line, hide);
  expect(await box.evaluate((el: HTMLInputElement) => el.validationMessage)).toBe("");
});

/** The stock of a merchandise, as the Inventaire shows it. */
async function stockOf(page: Page, name: string) {
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(name);
  return page.getByTestId(`stock-${name}`).getByTestId("stock-value");
}

test("sur sa page d'activité, un membre annule, rétablit et modifie son mouvement de stock, et le stock suit", async ({
  browser,
}) => {
  const hide = uniqueName("Patte de vasard");
  const meat = uniqueName("Gigot de chèvre");
  await createProduct(hide, { stock: 0 });
  await createProduct(meat, { stock: 10, unit: "morceau", category: "Viandes et venaison" });
  const { page, username } = await newEmployeePage(browser, "bruma");
  const reason = uniqueName("Chasse à Bruma");
  // In with the hide, out with the meat: one Mouvement de stock each way would do, a mixed one tests both.
  await createStockMovement(username, [[hide, 14], [meat, -3]], reason);
  const asked: string[] = [];
  page.on("dialog", (dialog) => {
    asked.push(dialog.message());
    void dialog.accept();
  });

  await page.getByTestId("member-name").click();
  await expect(page).toHaveURL(/\/membres\/\d+$/);
  const mine = page.url();
  const table = page.getByTestId("activite");
  const lines = table.locator("tbody tr").filter({ hasText: new RegExp(`${hide}|${meat}`) });
  await expect(lines).toHaveCount(2);
  // The whole entry's buttons on its first line, none on each line.
  await expect(lines.first().getByRole("link", { name: "Modifier les transactions : les 2 lignes de ce mouvement de stock" })).toBeVisible();
  await expect(table.getByRole("link", { name: /^Modifier le mouvement de stock/ })).toHaveCount(0);

  // All cancelled at once: the hides go out, the meat comes back.
  await lines.first().getByRole("button", { name: "Tout annuler : les 2 lignes de ce mouvement de stock" }).click();
  expect(asked.at(-1)).toContain(`• 14 × ${hide}\n• 3 × ${meat}`);
  await expect(lines.filter({ hasText: "Annulée par" })).toHaveCount(2);
  // A cancelled movement no longer counts in the member's stock tile.
  await expect(page.getByTestId("total-inventaire")).toContainText("(+0 / −0)");
  await expect(await stockOf(page, hide)).toHaveText("0");
  await expect(await stockOf(page, meat)).toHaveText("10");

  // And back.
  await page.goto(mine);
  await lines.first().getByRole("button", { name: "Tout rétablir : les 2 lignes de ce mouvement de stock" }).click();
  await expect(lines.filter({ hasText: "Annulée" })).toHaveCount(0);
  await expect(page.getByTestId("total-inventaire")).toContainText("(+14 / −3)");
  await expect(await stockOf(page, hide)).toHaveText("14");
  await expect(await stockOf(page, meat)).toHaveText("7");

  // One line cancelled alone, the other's units changed: back on the activity page.
  await page.goto(mine);
  await lines.first().getByRole("link", { name: /^Modifier les transactions/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Modifier un mouvement de stock" })).toBeVisible();
  await page.getByRole("button", { name: `Annuler ${meat}` }).click();
  expect(asked.at(-1)).toBe(`Annuler −3 ${meat} ?`);
  const edit = page.getByRole("region", { name: "Modifier les quantités" });
  await expect(edit.getByLabel(`${meat} (sortie)`)).toHaveCount(0);
  await edit.getByLabel(`${hide} (entrée)`).fill("10");
  await expect(edit.getByText("Avant : 14")).toBeVisible();
  await edit.getByRole("button", { name: "Enregistrer les quantités" }).click();
  await expect(page).toHaveURL(mine);
  const hideRow = lines.filter({ hasText: hide });
  await expect(hideRow).toContainText("+10");
  await expect(hideRow).toContainText("Modifiée par");
  // The meat, cancelled alone, has its own Rétablir.
  await expect(lines.filter({ hasText: meat }).getByRole("button", { name: /^Rétablir le mouvement de stock/ })).toBeVisible();
  await expect(await stockOf(page, hide)).toHaveText("10");
  await expect(await stockOf(page, meat)).toHaveText("10");
});

test("un mouvement de stock ne s'annule ni ne se modifie sous zéro, et chacun n'a les boutons que des siens", async ({
  page,
  browser,
}) => {
  const hide = uniqueName("Peau de lion");
  await createProduct(hide, { stock: 0 });
  const { page: employee, username } = await newEmployeePage(browser, "dar");
  const reason = uniqueName("Battue");
  const gerantReason = uniqueName("Coffre du gérant");
  await createStockMovement(username, [[hide, 6]], reason);
  await createStockMovement(GERANT.username, [[hide, 1]], gerantReason);
  // Four sold since: only three left.
  await setStock(hide, 3);

  // The employee sees buttons on their own movement only, in the Inventaire's history.
  await employee.goto(`/inventaire?q=${encodeURIComponent(hide)}`);
  const history = employee.getByTestId("historique");
  const own = history.getByRole("row").filter({ hasText: reason });
  await expect(own.getByRole("link", { name: /^Modifier le mouvement de stock/ })).toBeVisible();
  await expect(history.getByRole("row").filter({ hasText: gerantReason }).getByRole("button")).toHaveCount(0);

  // Cancelling the six that came in would take the stock below zero.
  employee.once("dialog", (dialog) => dialog.accept());
  await own.getByRole("button", { name: /^Annuler le mouvement de stock/ }).click();
  await expect(own.locator(ALERT)).toHaveText(`Impossible d'annuler : il ne reste que 3 ${hide} en stock.`);
  await expect(own).not.toContainText("Annulée");
  // Down to two: four leave, one more than is left.
  await own.getByRole("link", { name: /^Modifier le mouvement de stock/ }).click();
  const edit = employee.getByRole("region", { name: "Modifier les quantités" });
  await edit.getByLabel(`${hide} (entrée)`).fill("2");
  await edit.getByRole("button", { name: "Enregistrer les quantités" }).click();
  await expect(edit.locator(ALERT)).toHaveText(`Impossible : il ne reste que 3 ${hide} en stock.`);
  // Down to three: the stock is empty, the history comes back.
  await edit.getByLabel(`${hide} (entrée)`).fill("3");
  await edit.getByRole("button", { name: "Enregistrer les quantités" }).click();
  await expect(employee).toHaveURL(new RegExp(`/inventaire\\?q=`));
  await expect(own).toContainText("+3");
  await expect(await stockOf(employee, hide)).toHaveText("0");

  // A gérant has the buttons on the employee's movement too.
  await loginAsGerant(page);
  await page.goto(`/inventaire?q=${encodeURIComponent(hide)}`);
  await expect(
    page.getByTestId("historique").getByRole("row").filter({ hasText: reason }).getByRole("button", { name: /^Annuler le mouvement de stock/ }),
  ).toBeVisible();
});
