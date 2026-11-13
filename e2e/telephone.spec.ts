import { expect, test, type Page } from "@playwright/test";
import {
  createAnnouncements,
  createMember,
  createProduct,
  createTransactions,
  GERANT,
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
  const panel = await page.getByRole("region", { name: "Cuir", exact: true }).boundingBox();
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

  test("avec une police plus large, les boutons du Grand livre tiennent à toutes les largeurs", async ({ page }) => {
    await loginAsGerant(page);
    // Another computer's fonts can be wider than this one's: the buttons must not count on a few pixels.
    await page.addStyleTag({ content: ".move-actions .btn { letter-spacing: 0.08em !important; }" });
    const main = page.getByRole("main");
    const widths = [320, 360, 390, 430, 600, 800, 1000];
    for (let width = 1100; width <= 1700; width += 40) widths.push(width);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoSideScroll(page);
      // Every button stays inside the Grand livre's panel.
      const panel = (await main.locator(".panel").first().boundingBox())!;
      for (const name of ["Nouvel achat", "Nouvelle vente", "Mouvement de caisse", "Mouvement de stock"]) {
        const button = (await main.getByRole("link", { name, exact: true }).boundingBox())!;
        expect(button.x + button.width, `${name} à ${width} px`).toBeLessThanOrEqual(panel.x + panel.width);
      }
    }
  });

  test("une page avec un bouton sous son titre garde le même espace avant son premier cadre", async ({ page }) => {
    await loginAsGerant(page);
    // From the bottom of the page's title block to the top of its first panel.
    const gapUnderTitle = () =>
      page.getByRole("heading", { level: 1 }).evaluate((h1) => {
        const head = h1.closest(".page-head")!.getBoundingClientRect();
        const panel = document.querySelector(".content .panel")!.getBoundingClientRect();
        return Math.round(panel.top - head.bottom);
      });
    await page.goto("/annonces");
    const usual = await gapUnderTitle();
    await page.goto("/tarifs");
    await expect(page.getByRole("link", { name: "Gérer les tarifs" })).toBeVisible();
    expect(await gapUnderTitle()).toBe(usual);
  });
});

test("à toutes les largeurs, de 320 à 1600 px, aucune page ne déborde ni ne coupe un tableau", async ({ page }) => {
  test.slow();
  // A pending sale of millions: the longest amount and button a register card holds.
  const product = uniqueName("Couronne de Nordique");
  await createProduct(product, { stock: 1, sellPrice: 7_000_000 });
  await loginAsGerant(page);
  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form, product);
  await form.getByLabel("Pas encore mis en caisse").check();
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: product })).toBeVisible();

  // The gérant's own activity page, where that sale is listed too.
  const activity = (await page.getByTestId("member-name").getAttribute("href"))!;
  // The page editing a parchment with a long title.
  const parchment = uniqueName("Grande battue des chasseurs de Vendeaume et de Rorikbourg");
  await createAnnouncements(GERANT.username, 1, parchment);
  // The Grand livre shows the whole board; the Annonces page could have it past its first page.
  await page.goto("/");
  const edit = (await page.getByRole("link", { name: `Modifier « ${parchment} 1 »` }).getAttribute("href"))!;
  const pages = ["/", "/achat-vente", "/achat-vente/vente", "/inventaire", "/tarifs", "/marchandises", "/fournisseurs", "/annonces", "/membres", activity, edit];
  for (let width = 320; width <= 1600; width += 160) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Other computers' fonts can be a little wider than this one's: the layout must not count on a few pixels.
      await page.addStyleTag({ content: "body { letter-spacing: 0.04em; }" });
      await expectNoSideScroll(page);
      // A table wider than its box would hide its last columns behind a sideways scroll.
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll(".table-wrap")]
          .filter((wrap) => wrap.scrollWidth > wrap.clientWidth + 1)
          .map((wrap) => wrap.querySelector("th")?.textContent ?? "?"),
      );
      expect(cut, `${path} à ${width} px`).toEqual([]);
    }
  }
});
