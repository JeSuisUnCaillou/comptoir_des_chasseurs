import { expect, test, type Page } from "@playwright/test";
import { COMPTOIR, createContract, createProduct, loginAsGerant, newEmployeePage, pickProduct, uniqueName } from "./helpers";

function card(page: Page, name: string) {
  return page.getByRole("article", { name, exact: true });
}

/** A merchandise's line on a contract's card. */
function line(page: Page, contract: string, product: string) {
  return card(page, contract).getByRole("list", { name: `Marchandises de ${contract}` }).getByRole("listitem").filter({ hasText: product });
}

/** On a contract's page, asks `quantity` of a merchandise. */
async function ask(page: Page, product: string, unit: string, quantity: number) {
  const form = page.getByRole("form", { name: "Demander une marchandise" });
  await pickProduct(form, `${product} (${unit})`);
  await form.getByLabel("Quantité demandée").fill(String(quantity));
  await form.getByRole("button", { name: "Enregistrer la marchandise" }).click();
  await expect(page.getByRole("list", { name: "Marchandises demandées" }).getByRole("listitem").filter({ hasText: product })).toBeVisible();
}

test("le gérant inscrit un contrat et suit le stock jusqu'à le livrer", async ({ page }) => {
  const contract = uniqueName("Commande du Jarl");
  const leather = uniqueName("Cuir de contrat");
  const meat = uniqueName("Viande de worker");
  const wolf = uniqueName("Peau de loup");
  await createProduct(leather, { unit: "cuir", stock: 3000, leather: true, category: "Autres ressources" });
  await createProduct(meat, { unit: "pièce", stock: 60, category: "Viandes et venaison" });
  await createProduct(wolf, { stock: 40 });
  await loginAsGerant(page);

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Contrats" }).click();
  await expect(page.getByRole("heading", { name: "Contrats", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Nouveau contrat" }).click();
  await expect(page.getByRole("heading", { name: "Nouveau contrat", level: 1 })).toBeVisible();
  await page.getByLabel("Nom du contrat").fill(contract);
  await page.getByLabel("Client").fill("Jarl de Vendeaume");
  await page.getByLabel("Échéance").fill("2099-11-30");
  await page.getByRole("button", { name: "Créer le contrat" }).click();
  await expect(page.getByRole("heading", { name: contract, level: 1 })).toBeVisible();
  await expect(page.getByText("Aucune marchandise demandée pour l'instant.")).toBeVisible();

  await ask(page, leather, "cuir", 12_000);
  await ask(page, meat, "pièce", 60);
  await ask(page, wolf, "peau", 50);
  // The same merchandise again changes its quantity.
  await ask(page, wolf, "peau", 60);
  const wolfRow = page.getByRole("list", { name: "Marchandises demandées" }).getByRole("listitem").filter({ hasText: wolf });
  await expect(wolfRow).toContainText("40 / 60 peaux");
  await expect(page.getByRole("list", { name: "Marchandises demandées" }).getByRole("listitem")).toHaveCount(3);

  // On the Contrats page: each merchandise against the stock, and the whole.
  await page.getByRole("link", { name: "← Contrats" }).click();
  const open = card(page, contract);
  await expect(open).toContainText("Jarl de Vendeaume");
  await expect(open).toContainText("Pour le 30 novembre 2099");
  await expect(open.getByText("En cours", { exact: true })).toBeVisible();
  await expect(line(page, contract, leather)).toContainText(/3\s000 \/ 12\s000 cuirs/);
  await expect(line(page, contract, leather)).toContainText(/Manque 9\s000 cuirs/);
  await expect(line(page, contract, meat)).toContainText("60 / 60 pièces");
  await expect(line(page, contract, meat)).toContainText("Prêt");
  await expect(line(page, contract, wolf)).toContainText("40 / 60 peaux");
  await expect(line(page, contract, wolf)).toContainText("Manque 20 peaux");
  // Each line weighs the same: (25 + 100 + 66.7) / 3 = 63 %.
  await expect(open).toContainText("63 %");
  await expect(open).toContainText("1 marchandise prête sur 3");
  await expect(open.getByRole("progressbar", { name: `Progression de ${contract}` })).toHaveAttribute("aria-valuenow", "63");

  // A purchase of 30 wolf pelts: the contract follows the stock, beyond what it asks.
  await page.goto("/achat-vente/achat");
  const purchase = page.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(purchase, wolf);
  await purchase.getByLabel("Quantité").fill("30");
  await purchase.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(page.getByRole("status").filter({ hasText: wolf })).toBeVisible();
  await page.goto(`${COMPTOIR}/contrats`);
  await expect(line(page, contract, wolf)).toContainText("60 / 60 peaux");
  await expect(line(page, contract, wolf)).toContainText("Prêt · 70 en stock");
  await expect(open).toContainText("2 marchandises prêtes sur 3");

  // Taking the leather off: everything asked is in stock.
  await open.getByRole("link", { name: `Modifier ${contract}` }).click();
  await page.getByRole("button", { name: `Retirer ${leather}` }).click();
  await expect(page.getByRole("list", { name: "Marchandises demandées" }).getByRole("listitem")).toHaveCount(2);
  await page.getByRole("link", { name: "← Contrats" }).click();
  await expect(open.getByText("Prêt à livrer", { exact: true })).toBeVisible();
  await expect(open).toContainText("100 %");

  // Delivered: it goes under « Contrats livrés », and the stock stays.
  await open.getByRole("link", { name: `Modifier ${contract}` }).click();
  await page.getByRole("button", { name: "Marquer comme livré" }).click();
  await expect(page.getByRole("heading", { name: "Contrats", level: 1 })).toBeVisible();
  const delivered = page.getByRole("region", { name: "Contrats livrés" });
  await expect(delivered.getByRole("article", { name: contract, exact: true }).getByText("Livré", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Contrats en cours" }).getByRole("article", { name: contract })).toHaveCount(0);
  // Opened again, then deleted.
  await page.goto(`${COMPTOIR}/contrats`);
  await delivered.getByRole("link", { name: `Modifier ${contract}` }).click();
  await page.getByRole("button", { name: "Rouvrir le contrat" }).click();
  await expect(page.getByRole("button", { name: "Marquer comme livré" })).toBeVisible();
  // Delivering moved no stock.
  await expect(wolfRow).toContainText("70 / 60 peaux");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Supprimer le contrat" }).click();
  await expect(page.getByRole("heading", { name: "Contrats", level: 1 })).toBeVisible();
  await expect(card(page, contract)).toHaveCount(0);
});

test("un contrat dont l'échéance est passée le dit, et un nom vide est refusé", async ({ page }) => {
  const contract = uniqueName("Battue en retard");
  const hide = uniqueName("Peau d'ours");
  await createProduct(hide, { stock: 5 });
  await createContract(contract, [[hide, 10]], { dueOn: "2020-01-15" });
  await loginAsGerant(page);
  await page.goto(`${COMPTOIR}/contrats`);
  await expect(card(page, contract).getByText("Échéance passée", { exact: true })).toBeVisible();
  await expect(card(page, contract)).toContainText("Pour le 15 janvier 2020");
  await expect(card(page, contract)).toContainText("50 %");

  await card(page, contract).getByRole("link", { name: `Modifier ${contract}` }).click();
  await page.getByLabel("Nom du contrat").fill("   ");
  await page.getByRole("button", { name: "Enregistrer le contrat" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Donne un nom au contrat." })).toBeVisible();
  // The day can be taken away.
  await page.getByLabel("Nom du contrat").fill(contract);
  await page.getByLabel("Échéance").fill("");
  await page.getByRole("button", { name: "Enregistrer le contrat" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Contrat enregistré." })).toBeVisible();
  await page.getByRole("link", { name: "← Contrats" }).click();
  await expect(card(page, contract)).not.toContainText("Pour le");
  await expect(card(page, contract).getByText("Échéance passée")).toHaveCount(0);
});

test("un employé suit les contrats sans pouvoir les modifier", async ({ browser }) => {
  const contract = uniqueName("Commande de Rorikbourg");
  const hide = uniqueName("Peau de renard");
  await createProduct(hide, { stock: 2 });
  await createContract(contract, [[hide, 8]]);
  const { page } = await newEmployeePage(browser, "employe-contrats");

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Contrats" }).click();
  await expect(line(page, contract, hide)).toContainText("2 / 8 peaux");
  await expect(page.getByRole("link", { name: "Nouveau contrat" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: `Modifier ${contract}` })).toHaveCount(0);

  // The gérant's pages send them back home.
  await page.goto(`${COMPTOIR}/contrats/nouveau`);
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
});
