import { expect, test, type Page } from "@playwright/test";
import { createProduct, loginAs, newEmployeePage, pickProduct, uniqueName } from "./helpers";

/** The « À régler » notification: beside the name on a wide screen, above the page on a narrow one (the other copy is hidden). */
function notification(page: Page) {
  return page.getByTestId("a-regler").filter({ visible: true });
}

test("la notification « À régler » mène l'employé à ses septims pas encore en caisse, puis s'en va", async ({ browser }) => {
  const product = uniqueName("Peau de renard des neiges");
  await createProduct(product, { stock: 5, sellPrice: 4 });
  const { page } = await newEmployeePage(browser, "brenuin");
  const { page: colleague } = await newEmployeePage(browser, "ingun");

  // Nothing to settle yet: no notification.
  await expect(notification(page)).toHaveCount(0);

  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill("3");
  await expect(form.getByLabel("Pas encore mis en caisse")).toBeChecked();
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: product })).toBeVisible();

  // On every page, the notification says what is left to do; a colleague has none.
  const notice = notification(page);
  await expect(notice).toContainText("À régler");
  await expect(notice).toContainText("12 septims à mettre en caisse");
  await colleague.goto("/inventaire");
  await expect(notification(colleague)).toHaveCount(0);

  await notice.click();
  await expect(page.getByRole("heading", { name: "À régler", level: 1 })).toBeVisible();
  await expect(page.getByTestId("a-mettre-en-caisse")).toContainText("12 septims");
  await expect(page.getByRole("region", { name: "Mon stock à déposer" })).toContainText("Rien à déposer dans le stock.");
  const row = page.getByTestId("registre").getByRole("row").filter({ hasText: product });
  await expect(row).toContainText("+12 septims");

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: /^Mettre en caisse/ }).click();
  await expect(page.getByRole("region", { name: "Mes septims" })).toContainText(
    "Rien à régler : tous tes septims sont en caisse.",
  );
  await expect(notification(page)).toHaveCount(0);
});

test("un achat avec « Rappelle-moi de déposer ça dans le stock » attend dans À régler, sans retarder le stock", async ({
  browser,
}) => {
  const wolf = uniqueName("Peau de loup gris");
  const bear = uniqueName("Peau d'ours brun");
  await createProduct(wolf, { buyPrice: 2 });
  await createProduct(bear, { buyPrice: 5 });
  const { page } = await newEmployeePage(browser, "gerdur");

  await page.goto("/achat-vente/achat");
  const form = page.getByRole("region", { name: "Inscrire un achat" });
  const reminder = form.getByLabel("Rappelle-moi de déposer ça dans le stock");
  await expect(reminder).not.toBeChecked();
  await pickProduct(form, wolf);
  await form.getByLabel("Quantité").fill("3");
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(form.getByRole("group", { name: "Marchandise 2", exact: true }), bear);
  // An article outside the stock has nothing to put in the chest.
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  const other = form.getByRole("group", { name: "Marchandise 3", exact: true });
  await pickProduct(other, "Autre article (hors stock)…");
  await other.getByLabel("Nom de l'article").fill("Corne");
  await other.getByLabel("Montant (septims)").fill("4");
  await form.getByLabel("Nom RP du client / vendeur (facultatif)").fill(uniqueName("Elrindir"));
  await form.getByLabel("Pas encore sorti de la caisse").uncheck();
  await reminder.check();
  await form.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(page.getByRole("status").filter({ hasText: wolf })).toBeVisible();

  // Only a reminder: the stock moved with the purchase.
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(wolf);
  await expect(page.getByTestId(`stock-${wolf}`).getByTestId("stock-value")).toHaveText("3");

  const notice = notification(page);
  await expect(notice).toContainText("2 marchandises à déposer");
  await expect(notice).not.toContainText("septims");
  await notice.click();
  const stock = page.getByRole("region", { name: "Mon stock à déposer" });
  const purchase = stock.getByRole("listitem");
  await expect(purchase).toHaveCount(1);
  await expect(purchase).toContainText(`3 × ${wolf}, 1 × ${bear}`);
  await expect(purchase).toContainText("à Elrindir-");

  await purchase.getByRole("button", { name: `C'est déposé : 3 × ${wolf}, 1 × ${bear}` }).click();
  await expect(stock).toContainText("Rien à déposer dans le stock.");
  await expect(notification(page)).toHaveCount(0);
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(wolf);
  await expect(page.getByTestId(`stock-${wolf}`).getByTestId("stock-value")).toHaveText("3");
});

test("une vente n'a pas de rappel de stock, et un achat annulé quitte toute la page À régler", async ({ browser }) => {
  const product = uniqueName("Peau de chèvre des montagnes");
  await createProduct(product, { stock: 2, buyPrice: 1 });
  const { page } = await newEmployeePage(browser, "lod");

  await page.goto("/achat-vente/vente");
  await expect(page.getByLabel("Rappelle-moi de déposer ça dans le stock")).toHaveCount(0);

  // A purchase waiting for the till and for the chest.
  await page.goto("/achat-vente/achat");
  const form = page.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(form, product);
  await expect(form.getByLabel("Pas encore sorti de la caisse")).toBeChecked();
  await form.getByLabel("Rappelle-moi de déposer ça dans le stock").check();
  await form.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(notification(page)).toContainText("1 septim à sortir de la caisse · 1 marchandise à déposer");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("registre").getByRole("row").filter({ hasText: product }).getByRole("button", { name: /^Annuler/ }).click();
  await expect(notification(page)).toHaveCount(0);
  // Cancelled: nothing left to settle, neither its septims nor its merchandise.
  await page.goto("/le-comptoir-des-chasseurs/a-regler");
  await expect(page.getByRole("region", { name: "Mes septims" })).toContainText(
    "Rien à régler : tous tes septims sont en caisse.",
  );
  await expect(page.getByRole("region", { name: "Mon stock à déposer" })).toContainText("Rien à déposer dans le stock.");
});

/** A sale or purchase of `quantity` × `product`, left waiting for the till. */
async function recordPending(page: Page, kind: "vente" | "achat", product: string, quantity: number) {
  await page.goto(`/achat-vente/${kind}`);
  const form = page.getByRole("region", { name: kind === "vente" ? "Inscrire une vente" : "Inscrire un achat" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill(String(quantity));
  await expect(form.getByLabel(kind === "vente" ? "Pas encore mis en caisse" : "Pas encore sorti de la caisse")).toBeChecked();
  await form.getByRole("button", { name: kind === "vente" ? "Confirmer la vente" : "Confirmer l'achat" }).click();
  await expect(page.getByRole("status").filter({ hasText: product })).toBeVisible();
}

test("« Tout régler » donne le solde à mettre en caisse et règle toutes les écritures d'un coup", async ({ browser }) => {
  const product = uniqueName("Peau de sabrecat");
  await createProduct(product, { stock: 10, sellPrice: 4, buyPrice: 5 });
  const { page, username } = await newEmployeePage(browser, "hroki");
  // 12 septims cashed, 5 paid: 7 to put in the till.
  await recordPending(page, "vente", product, 3);
  await recordPending(page, "achat", product, 1);

  await page.goto("/le-comptoir-des-chasseurs/a-regler");
  const septimsPart = page.getByRole("region", { name: "Mes septims" });
  // The button sits in the card of the side the net falls on, at its own size.
  const depositCard = page.getByTestId("a-mettre-en-caisse");
  const settleAll = depositCard.getByRole("button", { name: "Tout régler : mettre 7 septims en caisse" });
  await expect(depositCard).toContainText("12 septims");
  await expect(page.getByTestId("a-sortir-de-la-caisse")).toContainText("5 septims");
  await expect(page.getByTestId("a-sortir-de-la-caisse").getByRole("button")).toHaveCount(0);
  const [button, card] = await Promise.all([settleAll.boundingBox(), depositCard.boundingBox()]);
  expect(button!.width).toBeLessThan(card!.width - 36);

  // Said no: nothing moves.
  let message = "";
  page.once("dialog", (dialog) => {
    message = dialog.message();
    void dialog.dismiss();
  });
  await settleAll.click();
  await expect.poll(() => message).toContain("2 lignes");
  expect(message).toContain("À mettre en caisse : 12 septims");
  expect(message).toContain("À sortir de la caisse : 5 septims");
  expect(message).toContain("Au total, mettre 7 septims en caisse.");
  await expect(page.getByTestId("registre").getByRole("row").filter({ hasText: product })).toHaveCount(2);

  // Meanwhile, another sale from another tab: the 7 septims confirmed are no longer the whole story.
  const other = await (await browser.newContext()).newPage();
  await loginAs(other, username, "mot-de-passe");
  await recordPending(other, "vente", product, 1);
  page.once("dialog", (dialog) => dialog.accept());
  await settleAll.click();
  await expect(septimsPart.getByRole("alert")).toContainText("recharge la page");

  // Reloaded, the new net: 16 in, 5 out.
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await expect(notification(page)).toContainText("16 septims à mettre en caisse · 5 septims à sortir de la caisse");
  await septimsPart.getByRole("button", { name: "Tout régler : mettre 11 septims en caisse" }).click();
  await expect(septimsPart).toContainText("Rien à régler : tous tes septims sont en caisse.");
  await expect(notification(page)).toHaveCount(0);
});

test("« Tout régler » dit ce qu'il faut sortir de la caisse quand les achats l'emportent", async ({ browser }) => {
  const product = uniqueName("Peau de troll des glaces");
  await createProduct(product, { stock: 10, sellPrice: 2, buyPrice: 6 });
  const { page } = await newEmployeePage(browser, "jorleif");
  await recordPending(page, "vente", product, 1);
  await recordPending(page, "achat", product, 2);

  await page.goto("/le-comptoir-des-chasseurs/a-regler");
  const septimsPart = page.getByRole("region", { name: "Mes septims" });
  let message = "";
  page.once("dialog", (dialog) => {
    message = dialog.message();
    void dialog.accept();
  });
  await page
    .getByTestId("a-sortir-de-la-caisse")
    .getByRole("button", { name: "Tout régler : sortir 10 septims de la caisse" })
    .click();
  await expect(septimsPart).toContainText("Rien à régler : tous tes septims sont en caisse.");
  expect(message).toContain("Au total, sortir 10 septims de la caisse.");
});
