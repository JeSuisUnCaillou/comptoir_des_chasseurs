import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { createProduct, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

const ALERT = "[role=alert]:not(#__next-route-announcer__)";

async function addProduct(page: Page, name: string) {
  await page.goto("/marchandises");
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill(name);
  await form.getByLabel("Catégorie").selectOption("peau");
  await form.getByLabel("Unité (au singulier)").fill("peau");
  await page.getByRole("button", { name: "Ajouter la marchandise" }).click();
  await expect(async () => {
    await page.goto(`/marchandises?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("link", { name: `Modifier ${name}` })).toBeVisible({ timeout: 1000 });
  }).toPass();
}

test("entrées et sorties de stock, avec historique", async ({ page }) => {
  const name = uniqueName("Troll");
  await loginAsGerant(page);
  await addProduct(page, name);

  await page.getByRole("link", { name: "Inventaire" }).click();
  await page.getByLabel("Rechercher une marchandise").fill(name);
  const card = page.getByTestId(`stock-${name}`);
  await expect(card).toContainText("Rupture");
  await expect(card.getByRole("button", { name: "Sortie" })).toBeDisabled();

  await card.getByRole("button", { name: "Entrée" }).click();
  await card.getByLabel("Quantité entrée").fill("10");
  await card.getByLabel("Motif").fill("chasse du matin");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("10");
  // Only an empty stock gets a tag: no "En stock" once it is filled.
  await expect(card).not.toContainText("Rupture");
  await expect(card).not.toContainText("En stock");

  await card.getByRole("button", { name: "Sortie" }).click();
  await card.getByLabel("Quantité sortie").fill("4");
  await card.getByLabel("Motif").fill("transformation en cuir");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("6");

  const history = page.getByTestId("historique");
  const rows = history.getByRole("row").filter({ hasText: name });
  await expect(rows.filter({ hasText: "transformation en cuir" })).toContainText(
    /−4.*6 peaux.*Lomone/,
  );
  await expect(rows.filter({ hasText: "chasse du matin" })).toContainText("+10");
});

test("une sortie ne peut pas dépasser le stock", async ({ page }) => {
  const name = uniqueName("Mammouth");
  await loginAsGerant(page);
  await addProduct(page, name);
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(name);
  const card = page.getByTestId(`stock-${name}`);

  await card.getByRole("button", { name: "Entrée" }).click();
  await card.getByLabel("Quantité entrée").fill("2");
  await card.getByLabel("Motif").fill("arrivage");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("2");

  // Skip the browser's max check to hit the server-side guard.
  await card.getByRole("button", { name: "Sortie" }).click();
  await card.getByLabel("Quantité sortie").evaluate((el) => el.removeAttribute("max"));
  await card.getByLabel("Quantité sortie").fill("5");
  await card.getByLabel("Motif").fill("trop");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.locator(ALERT)).toHaveText("Stock insuffisant pour cette sortie.");
  await page.reload();
  await page.getByLabel("Rechercher une marchandise").fill(name);
  await expect(card.getByTestId("stock-value")).toHaveText("2");
});

/** Records a stock movement by a member straight in the database, `daysAgo` days ago. */
async function oldMovement(username: string, product: string, delta: number, reason: string, daysAgo: number) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`
      insert into stock_movements (product_id, delta, stock_after, member_id, reason, created_at)
      select p.id, ${delta}, p.stock, m.id, ${reason}, now() - make_interval(days => ${daysAgo})
      from products p, members m
      where p.name = ${product} and m.username = ${username.toLowerCase()}`;
  } finally {
    await sql.end();
  }
}

/** A day in Paris, `offset` days from today, as the date fields want it. */
function parisDate(offset = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(Date.now() + offset * 86_400_000),
  );
}

async function moveIn(page: Page, name: string, quantity: string, reason: string) {
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(name);
  const card = page.getByTestId(`stock-${name}`);
  await card.getByRole("button", { name: "Entrée" }).click();
  await card.getByLabel("Quantité entrée").fill(quantity);
  await card.getByLabel("Motif").fill(reason);
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByLabel("Quantité entrée")).toBeHidden();
}

test("filtrer l'historique : ce qu'un membre a ajouté la semaine passée", async ({ page, browser }) => {
  const name = uniqueName("Horker");
  await createProduct(name, { stock: 0 });
  const employee = await newEmployeePage(browser, "Faendal");
  await moveIn(employee.page, name, "5", "chasse de l'employé");
  await oldMovement(employee.username, name, 7, "vieille chasse", 10);

  await loginAsGerant(page);
  await moveIn(page, name, "3", "chasse du gérant");
  const card = page.getByTestId(`stock-${name}`);
  await card.getByRole("button", { name: "Sortie" }).click();
  await card.getByLabel("Quantité sortie").fill("1");
  await card.getByLabel("Motif").fill("sortie du gérant");
  await card.getByRole("button", { name: "Valider" }).click();
  await expect(card.getByTestId("stock-value")).toHaveText("7");

  // The search filters the history as you type.
  const history = page.getByRole("region", { name: "Historique des mouvements" });
  await history.getByRole("searchbox", { name: "Chercher une marchandise" }).fill(name);
  await expect(page).toHaveURL(new RegExp(`q=${name}`));
  const rows = page.getByTestId("historique").locator("tbody tr");
  await expect(rows).toHaveCount(4);
  await expect(page.getByTestId("historique-total")).toHaveText("4 mouvement(s)");

  // Everything this member added over the past week.
  const filters = page.getByRole("form", { name: "Filtrer l'historique" });
  await filters.getByLabel("Employé").selectOption({ label: employee.username });
  await filters.getByLabel("Mouvement").selectOption({ label: "Entrées" });
  await filters.getByLabel("Du").fill(parisDate(-7));
  await filters.getByLabel("Au").fill(parisDate());
  await filters.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/sens=entree/);
  await expect(page).toHaveURL(/employe=\d+/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(/\+5.*chasse de l'employé/);
  // The search survived the filters.
  await expect(history.getByRole("searchbox", { name: "Chercher une marchandise" })).toHaveValue(name);

  // Without the dates, the old movement comes back.
  await filters.getByLabel("Du").fill("");
  await filters.getByLabel("Au").fill("");
  await filters.getByRole("button", { name: "Filtrer" }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("vieille chasse");

  // Outputs only.
  await filters.getByLabel("Employé").selectOption({ label: "Tous" });
  await filters.getByLabel("Mouvement").selectOption({ label: "Sorties" });
  await filters.getByRole("button", { name: "Filtrer" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(/−1.*Lomone.*sortie du gérant/);

  await page.getByRole("link", { name: "Tout afficher" }).click();
  await expect(page).toHaveURL(/\/inventaire$/);
  await expect(filters.getByLabel("Mouvement")).toHaveValue("");
  await expect(history.getByRole("searchbox", { name: "Chercher une marchandise" })).toHaveValue("");
});
