import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { COMPTOIR, GERANT, createTransactions, loginAsGerant, newEmployeePage } from "./helpers";

// Declaring the end of the week changes the Grand livre of the whole comptoir.
test.describe.configure({ mode: "serial" });

/** Forgets every declared end of the week, as the tests found the comptoir. */
async function noWeekEnd() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`delete from week_ends where shop_id = 1`;
  } finally {
    await sql.end();
  }
}

test.afterAll(noWeekEnd);

/** The large figure (since the end of the week) and the discreet total of a tile. */
async function tile(page: Page, id: string) {
  const value = (await page.getByTestId(id).locator(".stat-value").textContent()) ?? "";
  const total = (await page.getByTestId(id).locator(".stat-total").textContent()) ?? "";
  return { value, total };
}

test("un gérant déclare la fin de semaine : les chiffres repartent de zéro, les totaux restent", async ({
  page,
  browser,
}) => {
  await noWeekEnd();
  const { page: employee, username } = await newEmployeePage(browser, "ysolda");
  await createTransactions(username, 1, { amount: 4_000 });
  await createTransactions(username, 1, { amount: 1_000, kind: "rachat" });

  // An employee sees the figures but cannot end the week.
  await employee.goto(COMPTOIR);
  await expect(employee.getByTestId("fin-de-semaine")).toContainText("aucune fin de semaine");
  await expect(employee.getByRole("button", { name: "Déclarer la fin de semaine" })).toHaveCount(0);

  await loginAsGerant(page);
  const before = await tile(page, "total-ventes");
  expect(before.total).toBe(`Total : ${before.value}`);
  const treasuryBefore = await page.getByTestId("tresorerie-actuelle").textContent();

  let question = "";
  page.once("dialog", (dialog) => {
    question = dialog.message();
    return dialog.accept();
  });
  await page.getByRole("button", { name: "Déclarer la fin de semaine" }).click();
  await expect(page.getByRole("status").filter({ hasText: "fin de semaine est déclarée" })).toBeVisible();
  expect(question).toMatch(/^Déclarer la fin de semaine \?/);

  await expect(page.getByTestId("fin-de-semaine")).toContainText(
    `Depuis la fin de semaine déclarée par ${GERANT.name} le`,
  );
  for (const id of ["caisse-totale", "total-ventes", "total-rachats", "solde-ventes-rachats"]) {
    await expect(page.getByTestId(id).locator(".stat-value")).toHaveText("0 septim");
  }
  await expect(page.getByTestId("total-ventes").locator(".stat-total")).toHaveText(before.total);
  await expect(page.getByTestId("tresorerie-actuelle")).toHaveText(treasuryBefore!);

  // A line written after the end of the week counts again; those before stay in the totals only.
  await createTransactions(username, 1, { amount: 7, at: "now()" });
  await page.reload();
  await expect(page.getByTestId("total-ventes").locator(".stat-value")).toHaveText("7 septims");
  await expect(page.getByTestId("caisse-totale").locator(".stat-value")).toHaveText("+7 septims");
  const after = await tile(page, "total-ventes");
  const amount = (text: string) => Number(text.replace(/\D/g, ""));
  expect(amount(after.total) - amount(before.total)).toBe(7);

  // The employee sees the same figures and who ended the week.
  await employee.reload();
  await expect(employee.getByTestId("fin-de-semaine")).toContainText(`déclarée par ${GERANT.name}`);
  await expect(employee.getByTestId("total-ventes").locator(".stat-value")).toHaveText("7 septims");
});
