import { expect, test, type Page } from "@playwright/test";
import {
  createMember,
  createProduct,
  createTransactions,
  loginAs,
  loginAsGerant,
  memberRow,
  pickProduct,
  uniqueName,
} from "./helpers";

// A small phone, as a member who manages the comptoir while playing.
const PHONE = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true };
test.use(PHONE);

/** The page does not scroll sideways: everything fits the screen's width. */
async function expectNoSideScroll(page: Page) {
  // On failure, names the first element that passes the screen's right edge while its parent does not.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth <= width) return "";
        const past = [...document.querySelectorAll("body *")].filter(
          (el) =>
            el.getBoundingClientRect().right > width + 1 &&
            el.parentElement!.getBoundingClientRect().right <= width + 1 &&
            !el.closest(".nav, .table-wrap"),
        );
        const el = past[0];
        return el ? `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} « ${el.textContent?.trim()} »` : "?";
      }),
    )
    .toBe("");
}

test("au téléphone, aucune page ne déborde sur le côté", async ({ page }) => {
  await loginAsGerant(page);
  const pages = [
    ["/", "Grand livre"],
    ["/achat-vente", "Achat / Vente"],
    ["/achat-vente/achat", "Nouvel achat"],
    ["/achat-vente/vente", "Nouvelle vente"],
    ["/achat-vente/caisse", "Mouvement de caisse"],
    ["/inventaire", "Inventaire"],
    ["/inventaire/mouvement", "Mouvement de stock"],
    ["/tarifs", "Tarifs"],
    ["/marchandises", "Gérer les tarifs"],
    ["/fournisseurs", "Fournisseurs"],
    ["/annonces", "Annonces"],
    ["/membres", "Membres"],
    ["/mot-de-passe", "Mot de passe"],
  ];
  for (const [path, title] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await expectNoSideScroll(page);
  }
  await page.getByTestId("member-name").click();
  await expect(page.getByRole("heading", { name: "Ses totaux" })).toBeVisible();
  await expectNoSideScroll(page);
});

test("au téléphone, les boutons du Grand livre et le menu tiennent dans l'écran", async ({ page }) => {
  await loginAsGerant(page);
  await expectNoSideScroll(page);
  for (const name of ["Nouvel achat", "Nouvelle vente", "Mouvement de caisse", "Mouvement de stock"]) {
    await expect(page.getByRole("main").getByRole("link", { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
  // The menu is one line that scrolls sideways; the current page's entry is brought into view.
  await page.goto("/membres");
  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await expect(menu.getByRole("link", { name: "Membres" })).toHaveAttribute("aria-current", "page");
  await expect(menu.getByRole("link", { name: "Membres" })).toBeInViewport({ ratio: 1 });
  await menu.getByRole("link", { name: "Grand livre" }).scrollIntoViewIfNeeded();
  await menu.getByRole("link", { name: "Grand livre" }).click();
  await expect(page.getByRole("heading", { name: "Grand livre" })).toBeVisible();
});

test("au téléphone, une ligne du registre montre son article, ses septims et ses boutons ensemble", async ({ page }) => {
  const product = uniqueName("Peau de chaurus");
  await createProduct(product, { stock: 4, sellPrice: 7 });
  await loginAsGerant(page);

  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill("2");
  await form.getByLabel("Pas encore mis en caisse").check();
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: product })).toBeVisible();

  await page.goto("/achat-vente");
  const line = page.getByTestId("registre").getByRole("row").filter({ hasText: product });
  await line.scrollIntoViewIfNeeded();
  // All of the line is on screen at once: no table to slide sideways.
  for (const part of [
    line.getByText(product, { exact: true }),
    line.getByText("+14 septims"),
    line.getByText("Pas encore en caisse"),
    line.getByRole("button", { name: /^Mettre en caisse/ }),
    line.getByRole("button", { name: /^Annuler/ }),
  ]) {
    await expect(part).toBeInViewport({ ratio: 1 });
  }
  await expectNoSideScroll(page);

  page.once("dialog", (dialog) => dialog.accept());
  await line.getByRole("button", { name: /^Mettre en caisse/ }).click();
  await expect(line.getByText("Pas encore en caisse")).toHaveCount(0);
});

test("au téléphone, les tarifs d'une peau se lisent sans faire glisser le tableau", async ({ page }) => {
  const hide = uniqueName("Peau de spriggan");
  await createProduct(hide, { buyPrice: 5, sellPrice: 9 });
  await loginAsGerant(page);
  await page.goto("/tarifs");
  await page.getByRole("searchbox").first().fill(hide);
  const row = page.getByRole("row").filter({ hasText: hide });
  await expect(row).toHaveCount(1);
  await row.scrollIntoViewIfNeeded();
  await expect(row.getByText("5 septims")).toBeInViewport({ ratio: 1 });
  await expect(row.getByText("9 septims")).toBeInViewport({ ratio: 1 });
  await expect(row.getByRole("link", { name: `Modifier ${hide}` })).toBeInViewport({ ratio: 1 });
  await expectNoSideScroll(page);
});

test("au téléphone, l'activité d'un membre et l'historique du stock se lisent en cartes", async ({ browser }) => {
  const product = uniqueName("Peau de skeever");
  const reason = uniqueName("Loyer de la cabane");
  await createProduct(product, { stock: 5, sellPrice: 3 });
  const username = uniqueName("brynjolf").toLowerCase();
  await createMember(username, "mot-de-passe", "employe");
  const page = await (await browser.newContext(PHONE)).newPage();
  await loginAs(page, username, "mot-de-passe");

  await page.goto("/achat-vente/vente");
  const sale = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(sale, product);
  await sale.getByLabel("Quantité").fill("2");
  await sale.getByLabel("Pas encore mis en caisse").check();
  await sale.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: product })).toBeVisible();

  await page.goto("/achat-vente/caisse");
  const cash = page.getByRole("region", { name: "Inscrire un mouvement de caisse" });
  await cash.getByRole("radio", { name: "Sortie d'argent" }).check();
  await cash.getByLabel("Montant (septims)").fill("37");
  await cash.getByLabel("Motif").fill(reason);
  await cash.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page.getByRole("status")).toContainText(reason);

  // The member's own activity: each line whole on screen, with its button.
  await page.getByTestId("member-name").click();
  const activity = page.getByTestId("activite");
  const sold = activity.getByRole("row").filter({ hasText: product });
  await sold.scrollIntoViewIfNeeded();
  for (const part of [
    sold.getByText(product, { exact: true }),
    sold.getByText("+6 septims"),
    sold.getByRole("button", { name: /^Mettre en caisse/ }),
  ]) {
    await expect(part).toBeInViewport({ ratio: 1 });
  }
  const paid = activity.getByRole("row").filter({ hasText: reason });
  await paid.scrollIntoViewIfNeeded();
  await expect(paid.getByText("−37 septims")).toBeInViewport({ ratio: 1 });
  await expectNoSideScroll(page);

  // The stock history: the movement, the stock after it and who wrote it.
  await page.goto("/inventaire");
  const moved = page.getByTestId("historique").getByRole("row").filter({ hasText: product });
  await moved.scrollIntoViewIfNeeded();
  for (const part of [moved.getByText("−2"), moved.getByText("3 peaux"), moved.getByText(username)]) {
    await expect(part).toBeInViewport({ ratio: 1 });
  }
  await expectNoSideScroll(page);
});

test("au téléphone, un gérant gère un compte et une marchandise sans faire glisser", async ({ page }) => {
  const username = uniqueName("lydia").toLowerCase();
  await createMember(username, "mot-de-passe", "employe");
  const product = uniqueName("Corne de mammouth");
  await createProduct(product, { category: "ressource", unit: "corne" });
  await loginAsGerant(page);

  const row = await memberRow(page, username);
  await row.scrollIntoViewIfNeeded();
  for (const part of [
    row.getByLabel("Nom affiché"),
    row.getByLabel("Rôle"),
    row.getByRole("button", { name: "Enregistrer" }),
    row.getByLabel("Nouveau mot de passe"),
    row.getByRole("link", { name: "Activité" }),
  ]) {
    await expect(part).toBeInViewport({ ratio: 1 });
  }
  await expectNoSideScroll(page);

  await page.goto("/marchandises");
  await page.getByRole("searchbox").fill(product);
  const goods = page.getByRole("row").filter({ hasText: product });
  await expect(goods).toHaveCount(1);
  await goods.scrollIntoViewIfNeeded();
  await expect(goods.getByRole("link", { name: `Modifier ${product}` })).toBeInViewport({ ratio: 1 });
  await expectNoSideScroll(page);
});

test("au téléphone, la pagination tient dans l'écran", async ({ browser }) => {
  const username = uniqueName("erandur").toLowerCase();
  await createMember(username, "mot-de-passe", "employe");
  await createTransactions(username, 60);
  // The narrowest phones still in use: « Précédent », the page and « Suivant » cannot share a line.
  const page = await (await browser.newContext({ ...PHONE, viewport: { width: 320, height: 640 } })).newPage();
  await loginAs(page, username, "mot-de-passe");

  await page.getByTestId("member-name").click();
  const pages = page.getByRole("navigation", { name: "Pages de l'activité" });
  await pages.getByRole("link", { name: "Suivant" }).click();
  await expect(pages).toContainText("Page 2 sur 3");
  await pages.scrollIntoViewIfNeeded();
  for (const part of [
    pages.getByText("Page 2 sur 3"),
    pages.getByRole("link", { name: "Précédent" }),
    pages.getByRole("link", { name: "Suivant" }),
  ]) {
    await expect(part).toBeInViewport({ ratio: 1 });
  }
  await expectNoSideScroll(page);
});

test("au téléphone, les champs des filtres sont alignés et un bouton de page ne colle pas au cadre suivant", async ({
  page,
}) => {
  await loginAsGerant(page);

  // The date filters: « Du » and « Au » on their own lines, the two fields one under the other.
  await page.getByTestId("member-name").click();
  const filters = page.getByRole("form", { name: "Choisir la période" });
  const from = await filters.getByLabel("Du", { exact: true }).boundingBox();
  const to = await filters.getByLabel("Au", { exact: true }).boundingBox();
  expect(Math.round(to!.x)).toBe(Math.round(from!.x));
  expect(to!.y).toBeGreaterThan(from!.y + from!.height);

  // « Gérer les tarifs » under the title, with room before the first panel.
  await page.goto("/tarifs");
  const button = await page.getByRole("link", { name: "Gérer les tarifs" }).boundingBox();
  const panel = await page.getByRole("region", { name: "Tarifs du cuir" }).boundingBox();
  expect(panel!.y - (button!.y + button!.height)).toBeGreaterThanOrEqual(20);
});

test.describe("sur un écran moyen (tablette, petite fenêtre)", () => {
  test.use({ viewport: { width: 1000, height: 800 }, isMobile: false, hasTouch: false });

  test("les boutons du Grand livre passent deux par deux, sans déborder ni coller aux tuiles", async ({ page }) => {
    await loginAsGerant(page);
    await expectNoSideScroll(page);
    const main = page.getByRole("main");
    for (const name of ["Nouvel achat", "Nouvelle vente", "Mouvement de caisse", "Mouvement de stock"]) {
      await expect(main.getByRole("link", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
    const last = await main.getByRole("link", { name: "Mouvement de stock", exact: true }).boundingBox();
    const tile = await page.getByText("Trésorerie actuelle").boundingBox();
    expect(tile!.y - (last!.y + last!.height)).toBeGreaterThanOrEqual(12);
  });
});
