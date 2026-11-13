import { expect, test, type Page } from "@playwright/test";
import { COMPTOIR, loginAsGerant } from "./helpers";

/**
 * Holds every request for `path` made from now on until the returned function
 * is called, so the page stays slow to arrive.
 */
async function holdRequests(page: Page, path: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      await released;
      await route.continue();
    },
  );
  return release;
}

function menuLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name });
}

test("une page déjà préchargée montre tout de suite le chargement", async ({ page }) => {
  await loginAsGerant(page);
  // Let the menu links prefetch, as they do while a member reads the page.
  await page.waitForLoadState("networkidle");
  const release = await holdRequests(page, `${COMPTOIR}/inventaire`);

  await menuLink(page, "Inventaire").click();
  await expect(page.getByRole("status")).toContainText("Chargement…");

  release();
  await expect(page.getByRole("heading", { name: "Inventaire", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("un lien cliqué avant son préchargement montre qu'il travaille", async ({ page }) => {
  const release = await holdRequests(page, `${COMPTOIR}/inventaire`);
  await loginAsGerant(page);

  const link = menuLink(page, "Inventaire");
  await link.click();
  await expect(link.getByTestId("nav-pending")).toBeVisible();

  release();
  await expect(page.getByRole("heading", { name: "Inventaire", exact: true })).toBeVisible();
  await expect(link.getByTestId("nav-pending")).toHaveCount(0);
});

test("les pages n'affichent plus la mention « Registres » en tête", async ({ page }) => {
  await loginAsGerant(page);
  for (const [path, title] of [
    [COMPTOIR, "Grand livre"],
    ["/inventaire", "Inventaire"],
    ["/marchandises", "Gérer les marchandises"],
    ["/membres", "Membres"],
    ["/fournisseurs/nouveau", "Nouveau fournisseur"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
    await expect(page.getByText(/Registres ·/)).toHaveCount(0);
  }
});

test("l'onglet porte le nom de la boutique, ou Registre de Lomone hors boutique", async ({ page }) => {
  await page.goto("/connexion");
  await expect(page).toHaveTitle("Registre de Lomone");

  await loginAsGerant(page);
  const shop = (await page.getByTestId("shop-name").textContent())!;
  await expect(page).toHaveTitle(shop);

  await menuLink(page, "Inventaire").click();
  await expect(page.getByRole("heading", { name: "Inventaire", exact: true })).toBeVisible();
  await expect(page).toHaveTitle(shop);

  await page.goto(`${COMPTOIR}/achat-vente/vente`);
  await expect(page).toHaveTitle(shop);

  await page.goto("/boutiques");
  await expect(page).toHaveTitle("Registre de Lomone");
  await expect(page.getByText(/Registre des marchands/)).toHaveCount(0);
});
