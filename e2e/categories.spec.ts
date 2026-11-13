import { expect, test, type Page } from "@playwright/test";
import { ALERT, dragAbove, loginAsGerant, uniqueName } from "./helpers";

/** The super admin opens a shop from Mes boutiques and lands in it; its address is returned. */
async function openShop(page: Page, name: string) {
  await loginAsGerant(page);
  await page.getByRole("link", { name: "Changer de boutique" }).click();
  const section = page.getByRole("region", { name: "Ouvrir une boutique", exact: true });
  await section.getByLabel("Nom de la boutique").fill(name);
  await section.getByRole("button", { name: "Ouvrir la boutique" }).click();
  await expect(page.getByTestId("shop-name")).toHaveText(name);
  return new URL(page.url()).pathname;
}

/** The categories panel of Gérer les marchandises. */
const panel = (page: Page) => page.getByRole("region", { name: "Catégories" });
const row = (page: Page, name: string) => panel(page).getByTestId(`categorie-${name}`);

test("une nouvelle boutique commence avec « Autres marchandises », que son gérant renomme, complète et vide", async ({
  page,
}) => {
  const shop = await openShop(page, uniqueName("Herboristerie"));
  await page.goto(`${shop}/marchandises`);
  await expect(panel(page).getByRole("listitem")).toHaveCount(1);
  await expect(row(page, "Autres marchandises").getByRole("textbox")).toHaveValue("Autres marchandises");

  // The last category stays: every merchandise needs one.
  await row(page, "Autres marchandises").getByRole("button", { name: "Supprimer la catégorie Autres marchandises" }).click();
  await expect(row(page, "Autres marchandises").locator(ALERT)).toHaveText("La boutique garde au moins une catégorie.");

  // Renamed, then two more added; a name can't be used twice.
  await row(page, "Autres marchandises").getByLabel("Nom de la catégorie Autres marchandises").fill("Plantes");
  await row(page, "Autres marchandises").getByRole("button", { name: "Renommer" }).click();
  await expect(row(page, "Plantes")).toContainText("Catégorie renommée.");
  for (const name of ["Potions", "Poisons"]) {
    await panel(page).getByLabel("Nouvelle catégorie").fill(name);
    await panel(page).getByRole("button", { name: "Ajouter" }).click();
    await expect(row(page, name)).toBeVisible();
  }
  await expect(panel(page).getByLabel("Nouvelle catégorie")).toHaveValue("");
  await panel(page).getByLabel("Nouvelle catégorie").fill("Potions");
  await panel(page).getByRole("button", { name: "Ajouter" }).click();
  await expect(panel(page).locator(ALERT)).toHaveText("Il y a déjà une catégorie à ce nom.");
  await expect(panel(page).getByRole("listitem")).toHaveCount(3);

  // A merchandise goes in Potions, chosen among the shop's categories, in their order.
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await expect(form.getByLabel("Catégorie").locator("option")).toHaveText(["Plantes", "Potions", "Poisons"]);
  const potion = uniqueName("Potion de soins");
  await form.getByLabel("Nom", { exact: true }).fill(potion);
  await form.getByLabel("Catégorie").selectOption("Potions");
  // Only hides turn into leather.
  await expect(form.getByLabel("Peaux par lot")).toHaveCount(0);
  await form.getByLabel("Prix en septims").nth(1).fill("12");
  await form.getByRole("button", { name: "Ajouter la marchandise" }).click();
  await expect(page.getByRole("row", { name: new RegExp(potion) })).toContainText("Potions");
  await expect(row(page, "Potions")).toContainText("1 marchandise");

  // A category holding a merchandise stays until it is emptied; an empty one goes.
  await row(page, "Potions").getByRole("button", { name: "Supprimer la catégorie Potions" }).click();
  await expect(row(page, "Potions").locator(ALERT)).toHaveText(
    "« Potions » contient encore 1 marchandise (archivées comprises) : change-les de catégorie d'abord.",
  );
  await row(page, "Poisons").getByRole("button", { name: "Supprimer la catégorie Poisons" }).click();
  await expect(row(page, "Poisons")).toHaveCount(0);
  await expect(panel(page).getByRole("listitem")).toHaveCount(2);

  // The Tarifs have a grid per category that has priced goods; the Inventaire filters on them.
  await page.goto(`${shop}/tarifs`);
  await expect(page.getByRole("region", { name: "Potions" })).toContainText(potion);
  await expect(page.getByRole("region", { name: "Plantes" })).toHaveCount(0);
  await page.goto(`${shop}/inventaire`);
  await expect(page.getByTestId("total-peaux")).toHaveCount(0);
  await expect(page.getByTestId("total-cuirs")).toHaveCount(0);
  await page.getByLabel("Catégorie").selectOption("Plantes");
  await expect(page.getByText("Aucune marchandise ne correspond.")).toBeVisible();
  await page.getByLabel("Catégorie").selectOption("Potions");
  await expect(page.getByTestId(`stock-${potion}`)).toContainText("Potions");
});

test("le comptoir garde ses catégories, et les peaux leur transformation en cuir", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/marchandises");
  await expect(panel(page).getByRole("listitem").getByRole("textbox").first()).toHaveValue("Peaux");
  for (const name of ["Peaux", "Viandes et venaison", "Autres ressources", "Composants alchimiques"]) {
    await expect(row(page, name)).toBeVisible();
  }
  await expect(row(page, "Peaux")).toContainText("se transforment en cuir par lots");
  await expect(row(page, "Autres ressources")).not.toContainText("cuir par lots");
  await page.goto("/inventaire");
  await expect(page.getByTestId("total-peaux")).toBeVisible();
  await expect(page.getByTestId("total-cuirs")).toBeVisible();
});

test("un gérant réordonne ses catégories en les glissant, ou au clavier, et tout l'app suit cet ordre", async ({ page }) => {
  const shop = await openShop(page, uniqueName("Bazar"));
  await page.goto(`${shop}/marchandises`);
  for (const name of ["Armes", "Armures"]) {
    await panel(page).getByLabel("Nouvelle catégorie").fill(name);
    await panel(page).getByRole("button", { name: "Ajouter" }).click();
    await expect(row(page, name)).toBeVisible();
  }
  const list = panel(page).getByRole("list", { name: "Catégories de la boutique" });
  // The categories' names, as their fields show them, in the list's order.
  const names = () => list.getByRole("listitem").getByRole("textbox").evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  await expect.poll(names).toEqual(["Autres marchandises", "Armes", "Armures"]);
  const handle = (name: string) => list.getByRole("button", { name: `Déplacer ${name}` });
  // Saved: a fresh page shows the same order, once the save has reached the server.
  const saved = (order: string[]) =>
    expect(async () => {
      await page.reload();
      await expect.poll(names, { timeout: 1000 }).toEqual(order);
    }).toPass();

  // Dragged by its handle above the first one, the others making room.
  await dragAbove(page, handle("Armures"), row(page, "Autres marchandises"));
  await expect.poll(names).toEqual(["Armures", "Autres marchandises", "Armes"]);
  await saved(["Armures", "Autres marchandises", "Armes"]);

  // With the keyboard, the handle keeping the focus.
  await handle("Armes").focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(names).toEqual(["Armures", "Armes", "Autres marchandises"]);
  await expect(handle("Armes")).toBeFocused();
  await saved(["Armures", "Armes", "Autres marchandises"]);

  // A new category comes last; the forms and the Inventaire follow the order.
  await panel(page).getByLabel("Nouvelle catégorie").fill("Bijoux");
  await panel(page).getByRole("button", { name: "Ajouter" }).click();
  await expect.poll(names).toEqual(["Armures", "Armes", "Autres marchandises", "Bijoux"]);
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await expect(form.getByLabel("Catégorie").locator("option")).toHaveText(["Armures", "Armes", "Autres marchandises", "Bijoux"]);
  await page.goto(`${shop}/inventaire`);
  await expect(page.getByLabel("Catégorie").locator("option")).toHaveText([
    "Toutes",
    "Armures",
    "Armes",
    "Autres marchandises",
    "Bijoux",
  ]);
});
