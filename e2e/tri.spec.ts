import { expect, test } from "@playwright/test";
import { createMember, createProduct, loginAsGerant, uniqueName } from "./helpers";

// Case and accents must not push "Élan" after "zèbre". Leather comes first,
// then each category in its order (hides, meats, other resources), by name.
test("le stock montre le cuir, puis chaque catégorie dans son ordre, chacune par nom", async ({ page }) => {
  const tag = uniqueName("Tri stock");
  await createProduct(`${tag} zèbre`);
  await createProduct(`${tag} Élan`);
  await createProduct(`${tag} loup`);
  await createProduct(`${tag} sanglier`, { category: "Viandes et venaison", unit: "morceau" });
  await createProduct(`${tag} Aurochs`, { category: "Viandes et venaison", unit: "morceau" });
  await createProduct(`${tag} Argent`, { category: "Autres ressources", unit: "lingot" });
  await createProduct(`${tag} Cuir`, { category: "Autres ressources", leather: true, unit: "pièce" });
  // A leading digit puts this resource ahead of the others by name.
  await createProduct(`0 ${tag} Ambre`, { category: "Autres ressources", unit: "pierre" });
  await loginAsGerant(page);

  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(tag);
  await expect(page.locator(".stock-card h3")).toHaveText([
    `${tag} Cuir`,
    `${tag} Élan`,
    `${tag} loup`,
    `${tag} zèbre`,
    `${tag} Aurochs`,
    `${tag} sanglier`,
    `0 ${tag} Ambre`,
    `${tag} Argent`,
  ]);

  // The sale form keeps its category groups in order, sorted by name inside each.
  await page.goto("/achat-vente/vente");
  const box = page.getByRole("combobox", { name: "Marchandise" });
  await box.fill(tag);
  const list = page.getByRole("listbox");
  await expect(list.getByRole("option")).toHaveText([
    `${tag} Élan`,
    `${tag} loup`,
    `${tag} zèbre`,
    `${tag} Aurochs`,
    `${tag} sanglier`,
    `0 ${tag} Ambre`,
    `${tag} Argent`,
    `${tag} Cuir`,
    "Autre article (hors stock)…",
  ]);
  await expect(list.locator(".combobox-group")).toHaveText(["Peaux", "Viandes et venaison", "Autres ressources"]);
});

test("Gérer les marchandises range les marchandises par nom", async ({ page }) => {
  const tag = uniqueName("Tri catalogue");
  await createProduct(`${tag} zèbre`);
  await createProduct(`${tag} Élan`, { category: "Viandes et venaison", unit: "morceau" });
  await createProduct(`${tag} loup`);
  await loginAsGerant(page);

  await page.goto(`/marchandises?q=${encodeURIComponent(tag)}`);
  await expect(page.locator("tbody tr td:first-child strong")).toHaveText([
    `${tag} Élan`,
    `${tag} loup`,
    `${tag} zèbre`,
  ]);
});

test("les membres sont rangés par nom, quel que soit leur rôle", async ({ page }) => {
  // A leading digit keeps them on the first page, ahead of the other tests' members.
  const tag = uniqueName("0 tri");
  const usernames = ["elan", "loup", "zebre"].map((n) => uniqueName(n).toLowerCase());
  await createMember(usernames[2], "mot-de-passe", "gerant", `${tag} zèbre`);
  await createMember(usernames[0], "mot-de-passe", "desactive", `${tag} Élan`);
  await createMember(usernames[1], "mot-de-passe", "employe", `${tag} loup`);
  await loginAsGerant(page);

  await page.goto("/membres");
  // A union locator lists the rows in page order.
  const rows = page.locator(usernames.map((u) => `[data-testid='member-${u}']`).join(", "));
  await expect(rows.locator("td:first-child")).toHaveText(usernames);
});

test("les sections des Tarifs sont rangées par nom, catégories mêlées", async ({ page }) => {
  const tag = uniqueName("Tri tarifs");
  await createProduct(`${tag} zinc`, { category: "Autres ressources", unit: "lingot" });
  await createProduct(`${tag} Ambre`, { category: "Autres ressources", unit: "pierre" });
  await loginAsGerant(page);

  await page.goto("/tarifs");
  const rows = page.getByRole("row").filter({ hasText: tag }).locator("td:first-child");
  await expect(rows).toHaveText([`${tag} Ambre`, `${tag} zinc`]);
});
