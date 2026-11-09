import { expect, test, type Page } from "@playwright/test";
import { createAnnouncements, GERANT, loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

function parchment(page: Page, title: string) {
  return page.getByRole("article", { name: title, exact: true });
}

async function pinParchment(page: Page, title: string, body: string, pin = "Couteau") {
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Annonces" }).click();
  await expect(page.getByRole("heading", { name: "Afficher un parchemin" })).toBeVisible();
  await page.getByLabel("Titre de l'annonce").fill(title);
  await page.getByLabel("Texte à afficher").fill(body);
  await page.getByRole("radio", { name: pin }).check();
  await page.getByRole("button", { name: "Accrocher le parchemin" }).click();
  await expect(page.getByRole("status")).toHaveText("Le parchemin est accroché au tableau.");
}

test("un employé accroche un parchemin, que tout le comptoir lit sur l'accueil", async ({ page, browser }) => {
  const { page: employee, username } = await newEmployeePage(browser, "einar");
  const title = uniqueName("Commande Fiole Blanche");
  await pinParchment(employee, title, "Pied de lutin\nOeil de smilodon", "Hache nordique");

  // The form is cleared for the next one, and the parchment is on the board.
  await expect(employee.getByLabel("Titre de l'annonce")).toHaveValue("");
  const note = parchment(employee, title);
  await expect(note).toContainText("Pied de lutin\nOeil de smilodon");
  await expect(note).toContainText(`Par ${username}`);
  await expect(note.getByTitle("Hache nordique")).toBeVisible();

  // The gérant sees it on the Grand livre, and the link to the whole board.
  await loginAsGerant(page);
  await expect(parchment(page, title)).toContainText(`Par ${username}`);
  await page.getByRole("link", { name: /Voir toutes les annonces \(\d+\)/ }).click();
  await expect(page).toHaveURL(/\/annonces$/);
  await expect(parchment(page, title)).toBeVisible();
});

test("seuls l'auteur et un gérant peuvent décrocher un parchemin", async ({ page, browser }) => {
  const { page: author } = await newEmployeePage(browser, "auteur");
  const { page: other } = await newEmployeePage(browser, "autre");
  const first = uniqueName("Contrat Morvunskar");
  const second = uniqueName("Infos");
  await pinParchment(author, first, "300 peaux de cervidé");
  await pinParchment(author, second, "Un Khajiit rachète nos viandes", "Morceau de viande");

  await other.goto("/annonces");
  await expect(parchment(other, first)).toBeVisible();
  await expect(other.getByRole("button", { name: `Décrocher « ${first} »` })).toHaveCount(0);

  await author.getByRole("button", { name: `Décrocher « ${first} »` }).click();
  await expect(parchment(author, first)).toHaveCount(0);

  await loginAsGerant(page);
  await page.goto("/annonces");
  await page.getByRole("button", { name: `Décrocher « ${second} »` }).click();
  await expect(parchment(page, second)).toHaveCount(0);
  await other.reload();
  await expect(parchment(other, second)).toHaveCount(0);
});

test("toutes les annonces sont paginées, l'accueil n'en montre que les dernières", async ({ page }) => {
  const title = uniqueName("Vieille annonce");
  await createAnnouncements(GERANT.username, 14, title);
  await loginAsGerant(page);
  await expect(page.locator(".parchment")).toHaveCount(6);

  await page.goto("/annonces");
  const pages = page.getByRole("navigation", { name: "Pages des annonces" });
  await expect(page.locator(".parchment")).toHaveCount(12);
  await expect(pages).toContainText(/Page 1 sur \d+ · \d+ annonces/);
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(pages).toContainText(/Page 2 sur \d+/);
  // The oldest of the batch is past the first twelve.
  await expect(parchment(page, `${title} 14`)).toBeVisible();
});

test("un parchemin sans titre est refusé, et la saisie reste", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto("/annonces");
  await page.getByLabel("Titre de l'annonce").fill("   ");
  await page.getByLabel("Texte à afficher").fill("Un texte sans titre");
  await page.getByRole("button", { name: "Accrocher le parchemin" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "titre" })).toHaveText("Donne un titre à l'annonce.");
  await expect(page.getByLabel("Texte à afficher")).toHaveValue("Un texte sans titre");
});

test("le menu du gérant : Annonces sous Inventaire, plus de Marchandises", async ({ page }) => {
  await loginAsGerant(page);
  const links = page.getByRole("navigation", { name: "Menu principal" }).getByRole("link");
  await expect(links).toHaveText(["Grand livre", "Achat / Vente", "Tarifs", "Inventaire", "Annonces", "Membres"]);
});
