import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createProduct, loginAsGerant, newEmployeePage, pickProduct, uniqueName } from "./helpers";

test("le gérant fixe un prix de rachat pour les citoyens d'Estemarche, appliqué à l'achat", async ({
  page,
  browser,
}) => {
  const name = uniqueName("Cuir tanné");
  await loginAsGerant(page);
  await page.goto("/marchandises");
  const form = page.getByRole("region", { name: "Ajouter une marchandise" });
  await form.getByLabel("Nom").fill(name);
  await form.getByLabel("Catégorie").selectOption("ressource");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).first().fill("3");
  await form.getByLabel("Prix pour les citoyens d'Estemarche").fill("4");
  await form.getByRole("spinbutton", { name: "Prix en septims" }).nth(1).fill("6");
  await form.getByRole("button", { name: "Ajouter la marchandise" }).click();
  await expect(page).toHaveURL(/\/marchandises$/);

  // Both buyback prices show on Tarifs, for every member.
  const { page: employee } = await newEmployeePage(browser, "brand-shei");
  await employee.getByRole("link", { name: "Tarifs" }).click();
  const row = employee.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("3 septims / unité");
  await expect(row).toContainText("Citoyens d'Estemarche : 4 septims / unité");

  // The amount follows the box "citizen of Estemarche".
  await employee.goto("/achat-vente/achat");
  const purchase = employee.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(purchase, name);
  await purchase.getByLabel("Quantité").fill("10");
  const amount = purchase.getByLabel("Montant (septims)");
  const citizen = purchase.getByLabel("Le vendeur est citoyen d'Estemarche");
  await expect(purchase.getByText("Citoyens : 4 septims / unité · autres vendeurs : 3 septims / unité")).toBeVisible();
  await expect(amount).toHaveValue("30");
  await expect(purchase.getByTestId("prix-par-defaut")).toHaveText("Prix par défaut : 3 septims / unité");
  await citizen.check();
  await expect(amount).toHaveValue("40");
  await expect(purchase.getByTestId("tarif")).toContainText("prix citoyen d'Estemarche");
  await expect(purchase.getByTestId("prix-par-defaut")).toHaveText(
    "Prix par défaut : 4 septims / unité (prix citoyen d'Estemarche)",
  );
  await citizen.uncheck();
  await expect(amount).toHaveValue("30");
  await citizen.check();
  await purchase.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(employee.getByRole("status").filter({ hasText: `10 × ${name}` })).toHaveText(
    `Achat inscrit : 10 × ${name}, 40 septims.`,
  );
});

test("sans prix citoyen, l'achat ne propose pas la case", async ({ browser }) => {
  const { page } = await newEmployeePage(browser, "onmund");
  await page.goto("/achat-vente/achat");
  const purchase = page.getByRole("region", { name: "Inscrire un achat" });
  await pickProduct(purchase, "Biche");
  await expect(purchase.getByLabel("Montant (septims)")).not.toHaveValue("");
  await expect(purchase.getByLabel("Le vendeur est citoyen d'Estemarche")).toHaveCount(0);
});

test("le prix citoyen du cuir a sa propre tuile sur les Tarifs", async ({ browser }) => {
  // The seeded leather; no other test reads its tiles.
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update products set citizen_buy_price = 5 where name = 'Cuir'`;
  } finally {
    await sql.end();
  }
  const { page } = await newEmployeePage(browser, "ralof");
  await page.getByRole("link", { name: "Tarifs" }).click();
  const leather = page.getByRole("region", { name: "Tarifs du cuir" });
  await expect(leather).toContainText("Rachat de cuir · autres vendeurs4 septims");
  await expect(leather.getByTestId("rachat-cuir-citoyens")).toHaveText("Rachat de cuir · citoyens d'Estemarche5 septims");
  // Buyback prices on the first line, resale prices on the second.
  const box = async (label: string) => (await leather.locator(".stat").filter({ hasText: label }).boundingBox())!;
  const top = async (label: string) => (await box(label)).y;
  // The citizens' price comes first.
  expect(await top("autres vendeurs")).toBe(await top("citoyens d'Estemarche"));
  expect((await box("citoyens d'Estemarche")).x).toBeLessThan((await box("autres vendeurs")).x);
  expect(await top("Vente de cuir")).toBeGreaterThan(await top("citoyens d'Estemarche"));
  expect(await top("Vente de cuir")).toBe(await top("Rachat par le forgeron"));
});

test("à l'achat de plusieurs marchandises, une seule case citoyen pour le vendeur", async ({ browser }) => {
  const leather = uniqueName("Cuir épais");
  const hide = uniqueName("Peau de daim");
  await createProduct(leather, { buyPrice: 3, category: "cuir", unit: "pièce" });
  await createProduct(hide, { buyPrice: 2 });
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    await sql`update products set citizen_buy_price = 4 where name = ${leather}`;
  } finally {
    await sql.end();
  }
  const { page } = await newEmployeePage(browser, "camilla");
  await page.goto("/achat-vente/achat");
  const purchase = page.getByRole("region", { name: "Inscrire un achat" });
  const line = (n: number) => purchase.getByRole("group", { name: `Marchandise ${n}`, exact: true });
  const citizen = purchase.getByLabel("Le vendeur est citoyen d'Estemarche");
  const total = purchase.getByTestId("total");

  await pickProduct(line(1), hide);
  await line(1).getByLabel("Quantité").fill("2");
  await expect(citizen).toHaveCount(0);
  await purchase.getByRole("button", { name: "Ajouter une marchandise" }).click();
  await pickProduct(line(2), leather);
  await line(2).getByLabel("Quantité").fill("10");
  await expect(total).toHaveText("Total de l'achat : 34 septims");

  // The box only changes the lines that have a citizens' price.
  await citizen.check();
  await expect(line(1).getByLabel("Montant (septims)")).toHaveValue("4");
  await expect(line(2).getByLabel("Montant (septims)")).toHaveValue("40");
  await expect(total).toHaveText("Total de l'achat : 44 septims");
  // Without the leather the box goes away, and comes back unticked.
  await pickProduct(line(2), hide);
  await expect(citizen).toHaveCount(0);
  await pickProduct(line(2), leather);
  await expect(citizen).not.toBeChecked();
  await expect(total).toHaveText("Total de l'achat : 34 septims");
  await citizen.check();
  await purchase.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(page.getByRole("status").filter({ hasText: leather })).toHaveText(
    `Achat inscrit : 2 × ${hide}, 10 × ${leather}, 44 septims au total.`,
  );
});
