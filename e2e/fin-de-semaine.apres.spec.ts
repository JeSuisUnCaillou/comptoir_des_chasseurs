import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { COMPTOIR, GERANT, createTransactions, loginAsGerant, newEmployeePage } from "./helpers";

// Declaring the end of the week changes the Grand livre of the whole comptoir.
test.describe.configure({ mode: "serial" });

async function withDb(run: (sql: postgres.Sql) => Promise<unknown>) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await run(sql);
  } finally {
    await sql.end();
  }
}

/** Forgets every declared end of the week, as the tests found the comptoir. */
function noWeekEnd() {
  return withDb((sql) => sql`delete from week_ends where shop_id = 1`);
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
  await expect(employee.getByTestId("total-ventes").locator(".stat-label")).toHaveText("Ventes depuis l'ouverture");

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
  for (const id of ["total-ventes", "total-rachats", "solde-ventes-rachats"]) {
    await expect(page.getByTestId(id).locator(".stat-value")).toHaveText("0 septim");
  }
  await expect(page.getByTestId("tresorerie-semaine")).toHaveText("0 septim depuis aujourd'hui");
  await expect(page.getByTestId("total-ventes").locator(".stat-total")).toHaveText(before.total);
  await expect(page.getByTestId("tresorerie-actuelle")).toHaveText(treasuryBefore!);
  for (const [id, title] of [
    ["total-ventes", "Ventes"],
    ["total-rachats", "Rachats"],
    ["solde-ventes-rachats", "Solde ventes − rachats"],
  ]) {
    await expect(page.getByTestId(id).locator(".stat-label")).toHaveText(`${title} depuis aujourd'hui`);
  }

  // A line written after the end of the week counts again; those before stay in the totals only.
  await createTransactions(username, 1, { amount: 7, at: "now()" });
  await page.reload();
  await expect(page.getByTestId("total-ventes").locator(".stat-value")).toHaveText("7 septims");
  await expect(page.getByTestId("tresorerie-semaine")).toHaveText("+7 septims depuis aujourd'hui");
  const after = await tile(page, "total-ventes");
  const amount = (text: string) => Number(text.replace(/\D/g, ""));
  expect(amount(after.total) - amount(before.total)).toBe(7);

  // The employee sees the same figures and who ended the week.
  await employee.reload();
  await expect(employee.getByTestId("fin-de-semaine")).toContainText(`déclarée par ${GERANT.name}`);
  await expect(employee.getByTestId("total-ventes").locator(".stat-value")).toHaveText("7 septims");

  // Three days later, each figure says how long it has been counting.
  await withDb((sql) => sql`update week_ends set declared_at = declared_at - interval '3 days' where shop_id = 1`);
  await employee.reload();
  for (const [id, title] of [
    ["total-ventes", "Ventes"],
    ["total-rachats", "Rachats"],
    ["solde-ventes-rachats", "Solde ventes − rachats"],
  ]) {
    await expect(employee.getByTestId(id).locator(".stat-label")).toHaveText(`${title} depuis 3 jours`);
  }
  // Other tests' lines of the last days now count too: only the words are sure.
  await expect(employee.getByTestId("tresorerie-semaine")).toHaveText(/ septims? depuis 3 jours$/);
});
