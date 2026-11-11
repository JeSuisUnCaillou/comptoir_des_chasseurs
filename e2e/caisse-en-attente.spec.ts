import { expect, test, type Page } from "@playwright/test";
import { createProduct, loginAsGerant, newEmployeePage, pickProduct, uniqueName } from "./helpers";

/** Shows only this member's lines in the register. */
async function onlyLinesOf(page: Page, name: string) {
  await page.goto("/achat-vente");
  await page.getByLabel("Employé").selectOption({ label: name });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/employe=\d+/);
}

test("une vente dont les septims ne sont pas encore déposés attend la caisse, puis y compte", async ({ browser }) => {
  const hide = uniqueName("Peau de sabrecat");
  const meat = uniqueName("Viande de cheval");
  await createProduct(hide, { stock: 5, sellPrice: 3 });
  await createProduct(meat, { stock: 5, sellPrice: 5, category: "viande", unit: "morceau" });
  const { page, username } = await newEmployeePage(browser, "sigurd");
  const { page: colleague } = await newEmployeePage(browser, "hroki");

  await page.goto("/achat-vente/vente");
  const form = page.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form, hide);
  await form.getByLabel("Quantité").fill("2");
  await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
  const second = form.getByRole("group", { name: "Marchandise 2", exact: true });
  await pickProduct(second, meat);
  await form.getByLabel("Je n'ai pas encore déposé les septims dans la caisse").check();
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(page.getByRole("status").filter({ hasText: hide })).toHaveText(
    `Vente inscrite : 2 × ${hide}, 1 × ${meat}, 11 septims au total, en attente de la caisse.`,
  );

  // Both lines wait for the till: their money is shown, not counted. The stock moved.
  await onlyLinesOf(page, username);
  const rows = page.getByTestId("registre").getByRole("row");
  await expect(rows.filter({ hasText: "En attente de la caisse" })).toHaveCount(2);
  await expect(page.getByTestId("totaux-registre").locator(".stat-value")).toHaveText("0 septim");
  await expect(page.getByTestId("en-attente")).toContainText("+11 septims");
  await expect(page.getByTestId("en-attente")).toContainText("11 septims à déposer");
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(hide);
  await expect(page.getByTestId(`stock-${hide}`).getByTestId("stock-value")).toHaveText("3");

  // A colleague cannot say the septims are in; the author can, for the whole sale at once.
  await onlyLinesOf(colleague, username);
  await expect(colleague.getByTestId("registre").getByRole("row").filter({ hasText: hide })).toContainText(
    "En attente de la caisse",
  );
  await expect(colleague.getByRole("button", { name: /déposés dans la caisse/ })).toHaveCount(0);

  // The confirmation says the click settles both lines, and their total.
  await onlyLinesOf(page, username);
  let question = "";
  page.once("dialog", (dialog) => {
    question = dialog.message();
    return dialog.accept();
  });
  await rows.filter({ hasText: hide }).getByRole("button", { name: /déposés dans la caisse/ }).click();
  await expect.poll(() => question).toBe(
    `Les septims de cette vente sont-ils déposés dans la caisse ?\n\n` +
      `Cela vaut pour ses 2 lignes, 11 septims en tout :\n• 2 × ${hide}\n• 1 × ${meat}`,
  );
  await expect(rows.filter({ hasText: "En attente de la caisse" })).toHaveCount(0);
  await expect(page.getByTestId("totaux-registre").locator(".stat-value")).toHaveText("+11 septims");
  await expect(page.getByTestId("en-attente")).toHaveCount(0);
  await expect(rows.filter({ hasText: meat })).toContainText("+5 septims");
});

test("un gérant dit que les septims d'un achat d'employé sont pris dans la caisse", async ({ page, browser }) => {
  const product = uniqueName("Peau de troll");
  await createProduct(product, { buyPrice: 4 });
  const { page: employee, username } = await newEmployeePage(browser, "ulfberth");

  await employee.goto("/achat-vente/achat");
  const form = employee.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill("3");
  await form.getByLabel("Je n'ai pas encore pris les septims dans la caisse").check();
  await form.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(employee.getByRole("status").filter({ hasText: product })).toHaveText(
    `Achat inscrit : 3 × ${product}, 12 septims, en attente de la caisse.`,
  );

  // The gérant finds it with the "En attente de la caisse" filter.
  await loginAsGerant(page);
  await page.goto("/achat-vente");
  await page.getByLabel("Opération").selectOption("En attente de la caisse");
  await page.getByLabel("Employé").selectOption({ label: username });
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/type=attente/);
  const row = page.getByTestId("registre").getByRole("row").filter({ hasText: product });
  await expect(row).toContainText("−12 septims");
  await expect(page.getByTestId("en-attente")).toContainText("12 septims à prendre");

  let question = "";
  page.once("dialog", (dialog) => {
    question = dialog.message();
    return dialog.accept();
  });
  await row.getByRole("button", { name: /pris dans la caisse/ }).click();
  await expect.poll(() => question).toMatch(/^Les septims de l'achat n°\d+ sont-ils pris dans la caisse \?$/);
  await expect(row).toHaveCount(0);
  await page.getByLabel("Opération").selectOption("Toutes");
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(row).not.toContainText("En attente de la caisse");
  await expect(page.getByTestId("totaux-registre").locator(".stat-value")).toHaveText("−12 septims");
});

test("l'activité d'un membre montre sa vente en attente de la caisse, hors de ses totaux", async ({ page, browser }) => {
  const product = uniqueName("Peau de chèvre");
  await createProduct(product, { stock: 4, sellPrice: 3 });
  const { page: employee, username } = await newEmployeePage(browser, "lydia");
  await employee.goto("/achat-vente/vente");
  const form = employee.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form, product);
  await form.getByLabel("Quantité").fill("2");
  await form.getByLabel("Je n'ai pas encore déposé les septims dans la caisse").check();
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(employee.getByRole("status").filter({ hasText: product })).toContainText("en attente de la caisse");

  await loginAsGerant(page);
  await onlyLinesOf(page, username);
  const memberId = new URL(page.url()).searchParams.get("employe");
  await page.goto(`/membres/${memberId}`);
  await expect(page.getByTestId("activite").getByRole("row").filter({ hasText: product })).toContainText(
    /\+6 septims\s*En attente de la caisse/,
  );
  await expect(page.getByTestId("total-ventes").locator(".stat-value")).toHaveText("0 septim");
});

test("depuis sa page d'activité, l'auteur dit que les septims sont déposés ou pris", async ({ page, browser }) => {
  const product = uniqueName("Peau de horker");
  await createProduct(product, { stock: 4, buyPrice: 2, sellPrice: 5 });
  const { page: employee } = await newEmployeePage(browser, "jordis");
  for (const [kind, form, box] of [
    ["vente", "Inscrire une vente", "Je n'ai pas encore déposé les septims dans la caisse"],
    ["achat", "Inscrire un achat", "Je n'ai pas encore pris les septims dans la caisse"],
  ] as const) {
    await employee.goto(`/achat-vente/${kind}`);
    const region = employee.getByRole("region", { name: form });
    await pickProduct(region, product);
    await region.getByLabel("Quantité").fill("2");
    await region.getByLabel(box).check();
    await region.getByRole("button", { name: kind === "vente" ? "Confirmer la vente" : "Confirmer l'achat" }).click();
    await expect(employee.getByRole("status").filter({ hasText: product })).toContainText("en attente de la caisse");
  }

  // Mon activité, reached by the member's name at the top right.
  await employee.getByTestId("member-name").click();
  await expect(employee).toHaveURL(/\/membres\/\d+$/);
  const memberPath = new URL(employee.url()).pathname;
  const rows = employee.getByTestId("activite").getByRole("row").filter({ hasText: product });
  await expect(rows.filter({ hasText: "En attente de la caisse" })).toHaveCount(2);
  await expect(employee.getByTestId("total-ventes").locator(".stat-value")).toHaveText("0 septim");

  employee.once("dialog", (dialog) => dialog.accept());
  await rows.getByRole("button", { name: /déposés dans la caisse/ }).click();
  await expect(rows.filter({ hasText: "En attente de la caisse" })).toHaveCount(1);
  await expect(employee.getByTestId("total-ventes").locator(".stat-value")).toHaveText("+10 septims");

  // A gérant settles the purchase from the same page.
  await loginAsGerant(page);
  await page.goto(memberPath);
  const gerantRows = page.getByTestId("activite").getByRole("row").filter({ hasText: product });
  page.once("dialog", (dialog) => dialog.accept());
  await gerantRows.getByRole("button", { name: /pris dans la caisse/ }).click();
  await expect(gerantRows.filter({ hasText: "En attente de la caisse" })).toHaveCount(0);
  await expect(page.getByTestId("total-achats").locator(".stat-value")).toHaveText("−4 septims");
  await expect(gerantRows.getByRole("button", { name: /dans la caisse/ })).toHaveCount(0);
});

test("le grand livre et la page Mouvement de caisse ne comptent une vente en attente qu'une fois les septims déposés", async ({ browser }) => {
  // An amount far above what other tests write, so their lines cannot blur the deltas.
  const label = uniqueName("Couronne de jarl");
  const { page: employee } = await newEmployeePage(browser, "balgruuf");
  const read = async (path: string, locator: (p: Page) => ReturnType<Page["getByTestId"]>) => {
    await employee.goto(path);
    return Number(((await locator(employee).textContent()) ?? "").replace(/\D/g, ""));
  };
  const till = async () => ({
    all: await read("/", (p) => p.getByTestId("caisse-totale").locator(".stat-value")),
    page: await read("/achat-vente/caisse", (p) => p.getByTestId("apercu-caisse")),
  });
  const before = await till();

  await employee.goto("/achat-vente/vente");
  const form = employee.getByRole("region", { name: "Inscrire une vente" });
  await pickProduct(form, "Autre article (hors stock)…");
  await form.getByLabel("Nom de l'article").fill(label);
  await form.getByLabel("Montant (septims)").fill("1000000");
  await form.getByLabel("Je n'ai pas encore déposé les septims dans la caisse").check();
  await form.getByRole("button", { name: "Confirmer la vente" }).click();
  await expect(employee.getByRole("status").filter({ hasText: label })).toContainText("en attente de la caisse");
  const waiting = await till();
  expect(Math.abs(waiting.all - before.all)).toBeLessThan(500_000);
  expect(Math.abs(waiting.page - before.page)).toBeLessThan(500_000);

  await employee.goto("/achat-vente");
  const row = employee.getByTestId("registre").getByRole("row").filter({ hasText: label });
  employee.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: /déposés dans la caisse/ }).click();
  await expect(row).not.toContainText("En attente de la caisse");
  const settled = await till();
  expect(settled.all - waiting.all).toBeGreaterThan(900_000);
  expect(settled.page - waiting.page).toBeGreaterThan(900_000);
});
