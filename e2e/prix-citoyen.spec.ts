import { expect, test } from "@playwright/test";
import { loginAsGerant, newEmployeePage, uniqueName } from "./helpers";

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
  await purchase.getByLabel("Article ou marchandise").selectOption({ label: name });
  await purchase.getByLabel("Quantité").fill("10");
  const amount = purchase.getByLabel("Montant total (septims)");
  const citizen = purchase.getByLabel("Le vendeur est citoyen d'Estemarche");
  await expect(amount).toHaveValue("30");
  await citizen.check();
  await expect(amount).toHaveValue("40");
  await expect(purchase.getByTestId("tarif")).toContainText("prix citoyen d'Estemarche");
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
  await purchase.getByLabel("Article ou marchandise").selectOption({ label: "Biche" });
  await expect(purchase.getByLabel("Montant total (septims)")).not.toHaveValue("");
  await expect(purchase.getByLabel("Le vendeur est citoyen d'Estemarche")).toHaveCount(0);
});
