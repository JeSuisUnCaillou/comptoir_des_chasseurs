import { expect, test, type Page } from "@playwright/test";
import { COMPTOIR, loginAsGerant, uniqueName } from "./helpers";

const LOGO = "e2e/fixtures/logo.png"; // 300 × 200 pixels

/** The super admin opens a shop of their own, and lands on its Grand livre. */
async function openShop(page: Page, name: string) {
  await page.goto("/boutiques");
  const section = page.getByRole("region", { name: "Ouvrir une boutique", exact: true });
  await section.getByLabel("Nom de la boutique").fill(name);
  await section.getByRole("button", { name: "Ouvrir la boutique" }).click();
  await expect(page.getByTestId("shop-name")).toHaveText(name);
  return new URL(page.url()).pathname;
}

/** The logo at the top of the menu, once the browser has drawn it. */
async function menuLogo(page: Page) {
  const logo = page.locator(".sidebar .brand-mark");
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  return {
    src: await logo.getAttribute("src"),
    size: await logo.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  };
}

const favicon = (page: Page) => page.locator('head link[rel="icon"]');

test("un gérant téléverse le logo de sa boutique : il devient son logo et l'icône de l'onglet", async ({ page, request }) => {
  await loginAsGerant(page);
  const name = uniqueName("Logo de Lomone");
  const shop = await openShop(page, name);
  expect((await menuLogo(page)).src).toBe("/icon.svg");
  await expect(favicon(page)).toHaveAttribute("href", "/icon.svg");

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Réglages" }).click();
  const section = page.getByRole("region", { name: "Logo" });
  await expect(section.getByRole("img", { name: "Logo actuel" })).toHaveAttribute("src", "/icon.svg");
  await expect(section.getByRole("button", { name: "Retirer le logo" })).toHaveCount(0);

  await section.getByLabel("Image du logo").setInputFiles(LOGO);
  await expect(section.getByRole("img", { name: "Aperçu du nouveau logo" })).toBeVisible();
  await section.getByRole("button", { name: "Enregistrer le logo" }).click();
  await expect(section.getByRole("status")).toHaveText("Logo enregistré.");

  // In the menu, shrunk to 256 pixels at most, proportions kept.
  await expect(page.locator(".sidebar .brand-mark")).toHaveAttribute("src", new RegExp(`^${shop}/logo\\?v=\\d+$`));
  const logo = await menuLogo(page);
  expect(logo.size).toEqual([256, 171]);

  // In the browser tab, on every page of the shop.
  await page.goto(`${shop}/inventaire`);
  await expect(favicon(page)).toHaveAttribute("href", logo.src!);
  const response = await request.get(logo.src!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toBe("image/png");

  // On its card in Mes boutiques.
  await page.goto("/boutiques");
  const card = page.getByRole("navigation", { name: "Mes boutiques" }).getByRole("article", { name });
  await expect(card.locator(".shop-card-logo")).toHaveAttribute("src", logo.src!);

  // The other shops keep theirs.
  await page.goto(COMPTOIR);
  expect((await menuLogo(page)).src).toBe("/icon.svg");
  await expect(favicon(page)).toHaveAttribute("href", "/icon.svg");

  // Removed, the app's comes back.
  await page.goto(`${shop}/reglages`);
  await section.getByRole("button", { name: "Retirer le logo" }).click();
  await expect(section.getByRole("status")).toHaveText("Logo retiré.");
  await expect(section.getByRole("img", { name: "Logo actuel" })).toHaveAttribute("src", "/icon.svg");
  expect((await menuLogo(page)).src).toBe("/icon.svg");
  await expect(favicon(page)).toHaveAttribute("href", "/icon.svg");
  // An old link to the logo leads to the app's.
  expect((await request.get(logo.src!)).url()).toMatch(/\/icon\.svg$/);
});

test("un fichier qui n'est pas une image est refusé avant l'envoi", async ({ page }) => {
  await loginAsGerant(page);
  await page.goto(`${COMPTOIR}/reglages`);
  const section = page.getByRole("region", { name: "Logo" });
  await section.getByLabel("Image du logo").setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("pas une image") });
  await expect(section.getByRole("alert")).toHaveText("Ce fichier n'est pas une image que le navigateur sait lire.");
  await expect(section.getByRole("button", { name: "Enregistrer le logo" })).toBeDisabled();
  await expect(section.getByRole("img", { name: "Logo actuel" })).toHaveAttribute("src", "/icon.svg");
});
