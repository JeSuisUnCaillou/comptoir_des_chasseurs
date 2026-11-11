import { expect, test, type Page } from "@playwright/test";
import {
  createAnnouncements,
  createMember,
  GERANT,
  loginAs,
  loginAsGerant,
  newEmployeePage,
  setRole,
  uniqueName,
} from "./helpers";

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

  // The gérant sees it on the Grand livre.
  await loginAsGerant(page);
  await expect(parchment(page, title)).toContainText(`Par ${username}`);
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

test("l'accueil montre tout le tableau, la page Annonces le pagine", async ({ page }) => {
  const title = uniqueName("Vieille annonce");
  await createAnnouncements(GERANT.username, 14, title);
  await loginAsGerant(page);
  // Every parchment of the batch is on the Grand livre, with no pages.
  for (const i of [1, 14]) await expect(parchment(page, `${title} ${i}`)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pages des annonces" })).toHaveCount(0);

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

test("le menu du gérant : Fournisseurs et Annonces sous Inventaire, plus de Marchandises", async ({ page }) => {
  await loginAsGerant(page);
  const links = page.getByRole("navigation", { name: "Menu principal" }).getByRole("link");
  await expect(links).toHaveText(["Grand livre", "Achat / Vente", "Tarifs", "Inventaire", "Fournisseurs", "Annonces", "Membres"]);
});

test("le serveur refuse de décrocher le parchemin d'un autre à qui n'est plus gérant", async ({ browser }) => {
  const { page: author } = await newEmployeePage(browser, "brenuin");
  const title = uniqueName("Cherche fourrures");
  await pinParchment(author, title, "Pour l'hiver");

  const username = uniqueName("jorgen").toLowerCase();
  await createMember(username, "mot-de-passe", "gerant");
  const page = await (await browser.newContext()).newPage();
  await loginAs(page, username, "mot-de-passe");
  await page.goto("/annonces");
  const takeDown = page.getByRole("button", { name: `Décrocher « ${title} »` });
  await expect(takeDown).toBeVisible();

  await setRole(username, "employe");
  // The server action answers without a message: wait for its answer before looking.
  const answered = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
  await takeDown.click();
  await answered;
  await author.reload();
  await expect(parchment(author, title)).toBeVisible();
  await page.reload();
  await expect(parchment(page, title)).toBeVisible();
  await expect(page.getByRole("button", { name: `Décrocher « ${title} »` })).toHaveCount(0);
});
