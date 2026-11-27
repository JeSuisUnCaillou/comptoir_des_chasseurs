import { expect, test, type Page } from "@playwright/test";
import { COMPTOIR, createContract, createProduct, loginAsGerant, newEmployeePage, pickProduct, uniqueName } from "./helpers";

/** A merchandise's line in the form of a new contract. */
function newLine(page: Page, n: number) {
  return page.getByRole("group", { name: `Marchandise ${n}`, exact: true });
}

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
  await page.getByLabel("Prix (septims)").fill("900");
  // Its merchandises are written with it, one line each.
  await pickProduct(newLine(page, 1), `${leather} (cuir)`);
  await newLine(page, 1).getByLabel("Quantité demandée").fill("12000");
  await page.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(newLine(page, 2), `${meat} (pièce)`);
  await newLine(page, 2).getByLabel("Quantité demandée").fill("60");
  await page.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(newLine(page, 3), `${wolf} (peau)`);
  await newLine(page, 3).getByLabel("Quantité demandée").fill("50");
  await page.getByRole("button", { name: "Créer le contrat" }).click();
  await expect(page.getByRole("heading", { name: "Contrats", level: 1 })).toBeVisible();
  await expect(line(page, contract, wolf)).toContainText("40 / 50 peaux");

  // On its page, the same merchandise again changes its quantity.
  await card(page, contract).getByRole("link", { name: `Modifier ${contract}` }).click();
  await expect(page.getByRole("heading", { name: contract, level: 1 })).toBeVisible();
  await ask(page, wolf, "peau", 60);
  const wolfRow = page.getByRole("list", { name: "Marchandises demandées" }).getByRole("listitem").filter({ hasText: wolf });
  await expect(wolfRow).toContainText("40 / 60 peaux");
  await expect(page.getByRole("list", { name: "Marchandises demandées" }).getByRole("listitem")).toHaveCount(3);

  // On the Contrats page: each merchandise against the stock, and the whole.
  await page.getByRole("link", { name: "← Contrats" }).click();
  const open = card(page, contract);
  await expect(open).toContainText("Jarl de Vendeaume");
  await expect(open).toContainText("Pour le 30 novembre 2099");
  await expect(open).toContainText("900 septims");
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

  // Delivered from its card: a sale of its merchandises at its price, whose septims are not in the till yet.
  let question = "";
  page.once("dialog", (dialog) => {
    question = dialog.message();
    return dialog.accept();
  });
  await open.getByRole("button", { name: `Livrer les marchandises de ${contract}` }).click();
  expect(question).toBe(`Livrer ${contract} ? Ses marchandises sortent du stock.`);
  const unpaid = page.getByRole("region", { name: "Livrés, argent attendu" });
  await expect(unpaid.getByRole("article", { name: contract, exact: true }).getByText("Livré, argent attendu", { exact: true })).toBeVisible();
  // Delivered, its card has no button to deliver it again.
  await expect(page.getByRole("button", { name: `Livrer les marchandises de ${contract}` })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Contrats en cours" }).getByRole("article", { name: contract })).toHaveCount(0);
  // Its merchandises left the stock: 70 - 60 wolf pelts.
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(wolf);
  await expect(page.getByTestId(`stock-${wolf}`).getByTestId("stock-value")).toHaveText("10");
  // In the register: a sale to the client, shared by quantity, its septims awaited.
  await page.goto("/achat-vente");
  const saleRow = page.getByTestId("registre").getByRole("row").filter({ hasText: wolf }).filter({ hasText: "Jarl de Vendeaume" });
  await expect(saleRow).toContainText("Pas encore en caisse");
  await expect(saleRow).toContainText("450 septims");

  // The money comes: the contract is paid, the sale counts in the till.
  await page.goto(`${COMPTOIR}/contrats`);
  await unpaid.getByRole("link", { name: `Modifier ${contract}` }).click();
  await expect(page.getByRole("heading", { name: "Livré, argent attendu" })).toBeVisible();
  await expect(page.getByLabel("Prix (septims)")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enregistrer la marchandise" })).toHaveCount(0);
  await page.getByRole("button", { name: "Argent reçu" }).click();
  const paid = page.getByRole("region", { name: "Contrats payés" });
  await expect(paid.getByRole("article", { name: contract, exact: true }).getByText("Payé", { exact: true })).toBeVisible();
  await expect(unpaid.getByRole("article", { name: contract })).toHaveCount(0);
  await page.goto("/achat-vente");
  await expect(saleRow).not.toContainText("Pas encore en caisse");
  await expect(saleRow).toContainText("+450 septims");

  // The delivery undone: its sale is cancelled, the pelts come back, the contract is open again.
  await page.goto(`${COMPTOIR}/contrats`);
  await paid.getByRole("link", { name: `Modifier ${contract}` }).click();
  await expect(page.getByRole("heading", { name: "Livré et payé" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Annuler la livraison" }).click();
  await expect(page.getByRole("button", { name: "Livrer les marchandises" })).toBeVisible();
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

test("le Grand livre montre les contrats en cours sous le tableau d'annonces, pas les livrés", async ({ browser }) => {
  const contract = uniqueName("Commande de Blancherive");
  const delivered = uniqueName("Commande livrée");
  const hide = uniqueName("Peau de chèvre");
  await createProduct(hide, { stock: 3 });
  await createContract(contract, [[hide, 12]]);
  const deliveredId = await createContract(delivered, [[hide, 1]]);
  const { page } = await newEmployeePage(browser, "employe-grand-livre-contrats");

  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
  const open = page.getByRole("region", { name: "Contrats en cours" });
  await expect(line(page, contract, hide)).toContainText("3 / 12 peaux");
  await expect(open.getByRole("article", { name: contract, exact: true })).toContainText("Manque 9 peaux");
  // Under the board, before the latest entries.
  const board = await page.getByRole("heading", { name: "Tableau d'annonces" }).boundingBox();
  const contracts = await open.boundingBox();
  const entries = await page.getByRole("heading", { name: "Dernières écritures" }).boundingBox();
  expect(contracts!.y).toBeGreaterThan(board!.y);
  expect(contracts!.y).toBeLessThan(entries!.y);
  // An employé reads them: no button to change them.
  await expect(open.getByRole("link", { name: `Modifier ${contract}` })).toHaveCount(0);

  // A delivered contract is gone from it.
  await expect(card(page, delivered)).toBeVisible();
  const gerant = await (await browser.newContext()).newPage();
  await loginAsGerant(gerant);
  await gerant.goto(`${COMPTOIR}/contrats/${deliveredId}`);
  gerant.once("dialog", (dialog) => dialog.accept());
  await gerant.getByRole("button", { name: "Livrer les marchandises" }).click();
  await expect(gerant.getByRole("heading", { name: "Livré et payé" })).toBeVisible();
  await page.goto(COMPTOIR);
  await expect(line(page, contract, hide)).toBeVisible();
  await expect(card(page, delivered)).toHaveCount(0);

  await open.getByRole("link", { name: "Tous les contrats →" }).click();
  await expect(page.getByRole("heading", { name: "Contrats", level: 1 })).toBeVisible();
});

test("un nouveau contrat refuse une marchandise demandée deux fois, et peut partir sans marchandise", async ({ page }) => {
  const contract = uniqueName("Commande vide");
  const hide = uniqueName("Peau de lynx");
  await createProduct(hide, { stock: 1 });
  await loginAsGerant(page);
  await page.goto(`${COMPTOIR}/contrats/nouveau`);
  await page.getByLabel("Nom du contrat").fill(contract);
  await pickProduct(newLine(page, 1), `${hide} (peau)`);
  await newLine(page, 1).getByLabel("Quantité demandée").fill("4");
  await page.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(newLine(page, 2), `${hide} (peau)`);
  await newLine(page, 2).getByLabel("Quantité demandée").fill("6");
  await page.getByRole("button", { name: "Créer le contrat" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Une marchandise est demandée deux fois." })).toBeVisible();
  // What was typed stays.
  await expect(newLine(page, 2).getByLabel("Quantité demandée")).toHaveValue("6");

  await page.getByRole("button", { name: "Retirer la marchandise 2" }).click();
  await page.getByRole("button", { name: "Retirer la marchandise 1" }).click();
  await expect(page.getByText("Aucune marchandise : tu pourras en ajouter depuis sa fiche.")).toBeVisible();
  await page.getByRole("button", { name: "Créer le contrat" }).click();
  await expect(page.getByRole("heading", { name: "Contrats", level: 1 })).toBeVisible();
  await expect(card(page, contract)).toContainText("Aucune marchandise demandée pour l'instant.");
});

test("le contrat suit sa vente au registre : une ligne annulée seule, la mise en caisse, l'annulation entière", async ({ page }) => {
  const contract = uniqueName("Commande suivie au registre");
  const leather = uniqueName("Cuir suivi");
  const pelt = uniqueName("Peau suivie");
  await createProduct(leather, { unit: "cuir", stock: 10, leather: true, category: "Autres ressources" });
  await createProduct(pelt, { stock: 10 });
  const id = await createContract(contract, [[leather, 4], [pelt, 6]], { price: 100 });
  await loginAsGerant(page);
  await page.goto(`${COMPTOIR}/contrats`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Livrer les marchandises de ${contract}` }).click();
  const unpaid = page.getByRole("region", { name: "Livrés, argent attendu" });
  await expect(unpaid.getByRole("article", { name: contract, exact: true })).toBeVisible();

  // The leather, its sale's first line, is cancelled alone: the pelts are still delivered.
  await page.goto("/achat-vente");
  const sale = page.getByTestId("registre").getByRole("row").filter({ hasText: new RegExp(`${leather}|${pelt}`) });
  await expect(sale).toHaveCount(2);
  await sale.getByRole("link", { name: /^Modifier les transactions/ }).click();
  const one = page.getByRole("region", { name: "Annuler une seule ligne" });
  page.once("dialog", (dialog) => dialog.accept());
  await one.getByRole("listitem").filter({ hasText: leather }).getByRole("button", { name: "Annuler" }).click();
  await expect(one.getByRole("listitem").filter({ hasText: leather })).toHaveCount(0);
  await page.goto(`${COMPTOIR}/contrats`);
  await expect(unpaid.getByRole("article", { name: contract, exact: true })).toBeVisible();

  // « Argent reçu » puts the rest of its sale in the till.
  await unpaid.getByRole("link", { name: `Modifier ${contract}` }).click();
  await page.getByRole("button", { name: "Argent reçu" }).click();
  const paid = page.getByRole("region", { name: "Contrats payés" });
  await expect(paid.getByRole("article", { name: contract, exact: true }).getByText("Payé", { exact: true })).toBeVisible();

  // Its whole sale cancelled in the register: the contract is open again.
  await page.goto("/achat-vente");
  page.once("dialog", (dialog) => dialog.accept());
  await sale.filter({ hasText: pelt }).getByRole("button", { name: /^Annuler la vente/ }).click();
  await expect(sale.filter({ hasText: pelt })).toContainText("Annulée");
  await page.goto(`${COMPTOIR}/contrats`);
  await expect(page.getByRole("region", { name: "Contrats en cours" }).getByRole("article", { name: contract, exact: true })).toBeVisible();
});

test("un contrat sans prix livré est payé d'emblée, un sans marchandise ne se livre pas, un prix faux est refusé", async ({ page }) => {
  const free = uniqueName("Commande offerte");
  const empty = uniqueName("Commande vide");
  const hide = uniqueName("Peau offerte");
  await createProduct(hide, { stock: 5 });
  const freeId = await createContract(free, [[hide, 2]]);
  const emptyId = await createContract(empty, []);
  await loginAsGerant(page);

  await page.goto(`${COMPTOIR}/contrats/${freeId}`);
  await expect(page.getByText("Sans prix, la vente est à 0 septim.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Livrer les marchandises" }).click();
  // The page stays on it, now delivered and paid.
  await expect(page.getByRole("heading", { name: "Livré et payé" })).toBeVisible();
  await page.goto(`${COMPTOIR}/contrats`);
  await expect(page.getByRole("region", { name: "Contrats payés" }).getByRole("article", { name: free, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Livrés, argent attendu" }).getByRole("article", { name: free })).toHaveCount(0);

  await page.goto(`${COMPTOIR}/contrats/${emptyId}`);
  await page.getByLabel("Prix (septims)").fill("100000001");
  await page.getByRole("button", { name: "Enregistrer le contrat" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Le prix doit être un nombre entier de septims" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Livrer les marchandises" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ce contrat ne demande aucune marchandise : rien à livrer." })).toBeVisible();
});

test("le créateur d'un contrat le livre depuis sa carte, un autre employé n'a pas le bouton", async ({ browser }) => {
  const hide = uniqueName("Peau de daim");
  await createProduct(hide, { stock: 5 });
  const { page: author, username } = await newEmployeePage(browser, "auteur-contrat");
  const { page: other } = await newEmployeePage(browser, "autre-employe-contrat");
  const contract = uniqueName("Commande de l'auteur");
  await createContract(contract, [[hide, 2]], { price: 30, author: username });

  // Another employee reads it on the Grand livre, without the button.
  await other.goto(COMPTOIR);
  await expect(card(other, contract)).toBeVisible();
  await expect(card(other, contract).getByRole("button", { name: /^Livrer/ })).toHaveCount(0);

  // Its author delivers it from the Grand livre.
  await author.goto(COMPTOIR);
  author.once("dialog", (dialog) => dialog.accept());
  await card(author, contract).getByRole("button", { name: `Livrer les marchandises de ${contract}` }).click();
  await expect(card(author, contract)).toHaveCount(0);
  await author.goto(`${COMPTOIR}/contrats`);
  const unpaid = author.getByRole("region", { name: "Livrés, argent attendu" });
  await expect(unpaid.getByRole("article", { name: contract, exact: true })).toBeVisible();
  // The rest stays with the gérants: no page to edit it.
  await expect(author.getByRole("link", { name: `Modifier ${contract}` })).toHaveCount(0);
});
