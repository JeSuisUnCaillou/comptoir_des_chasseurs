import { expect, test } from "@playwright/test";
import { loginAsGerant } from "./helpers";

test("l'onglet du navigateur affiche l'icône du comptoir", async ({ page, request }) => {
  await page.goto("/connexion");

  const icon = page.locator('head link[rel="icon"][type="image/svg+xml"]');
  await expect(icon).toHaveCount(1);
  const href = await icon.getAttribute("href");
  expect(href).toBeTruthy();

  const response = await request.get(href!);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await response.text()).toContain("<svg");
});

test("le logo du comptoir reprend l'icône, sur la connexion comme dans l'app", async ({ page }) => {
  const logoLoaded = async () => {
    const logo = page.locator('img[src="/icon.svg"]');
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  };

  await page.goto("/connexion");
  await logoLoaded();

  await loginAsGerant(page);
  await logoLoaded();
});
