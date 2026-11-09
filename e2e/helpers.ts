import type { Browser, Page } from "@playwright/test";

/** Signs in through the test-only route. Unknown names arrive "en attente". */
export async function loginAs(page: Page, name: string) {
  await page.goto(`/api/auth/test-login?name=${encodeURIComponent(name)}`);
}

export async function newMemberPage(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAs(page, name);
  return page;
}

/** A name unique to this test run, so parallel tests don't collide. */
export function uniqueName(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}
