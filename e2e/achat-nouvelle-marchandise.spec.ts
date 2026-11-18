import { expect, test } from "@playwright/test";
import { ALERT, createProduct, newEmployeePage, uniqueName } from "./helpers";

const NEW = "Nouvelle marchandise (entre en stock)…";

test("un achat crée la marchandise que la boutique ne connaît pas encore, et elle entre en stock", async ({ browser }) => {
  const name = uniqueName("Défense de horqueur");
  const { page } = await newEmployeePage(browser, "hilde");
  await page.goto("/achat-vente/achat");
  const form = page.getByRole("region", { name: "Inscrire un achat" });
  const box = form.getByRole("combobox", { name: "Marchandise", exact: true });

  // A name that matches nothing: on a purchase, Enter takes a new merchandise, with the typed name.
  await box.fill(name);
  await expect(form.getByRole("option", { name: NEW })).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(box).toHaveValue(NEW);
  const created = form.getByTestId("nouvelle-marchandise");
  await expect(created.getByLabel("Nom de la nouvelle marchandise")).toHaveValue(name);
  await expect(created.getByLabel("Unité (au singulier)")).toHaveValue("pièce");
  await expect(created).toContainText("Elle n'aura pas de prix au début");
  await created.getByLabel("Catégorie").selectOption("Autres ressources");
  await created.getByLabel("Unité (au singulier)").fill("défense");
  await form.getByLabel("Quantité").fill("40");
  // No tariff yet: the member types the amount paid.
  await expect(form.getByLabel("Montant (septims)")).toHaveValue("");
  await form.getByLabel("Montant (septims)").fill("700");
  await form.getByLabel("Nom RP du client / vendeur (facultatif)").fill(uniqueName("Chasseur"));
  await form.getByRole("button", { name: "Confirmer l'achat" }).click();

  await expect(page.getByRole("status").filter({ hasText: name })).toContainText(`40 × ${name}, 700 septims`);

  // The merchandise exists, with the 40 bought in stock, in its category, from the purchase.
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(name);
  const card = page.getByTestId(`stock-${name}`);
  await expect(card.getByTestId("stock-value")).toHaveText("40");
  await expect(card).toContainText("Autres ressources");
  await expect(page.getByTestId("historique").getByRole("row").filter({ hasText: name })).toContainText(/\+40.*Achat/);

  // The next purchase finds it in the list like any other merchandise.
  await page.goto("/achat-vente/achat");
  await box.fill(name);
  await expect(form.getByRole("option").first()).toHaveText(name);
});

test("un achat refuse une nouvelle marchandise au nom déjà pris, et passée en vente elle devient un article hors stock", async ({
  browser,
}) => {
  const taken = uniqueName("Peau de horqueur");
  await createProduct(taken, { stock: 2 });
  const fresh = uniqueName("Corne de horqueur");
  const { page } = await newEmployeePage(browser, "torvar");
  await page.goto("/achat-vente/achat");
  const form = page.getByRole("region", { name: "Inscrire un achat" });
  const line = (n: number) => form.getByRole("group", { name: `Marchandise ${n}` });

  // A new merchandise named like an existing one: refused, nothing written.
  await line(1).getByRole("combobox", { name: "Marchandise", exact: true }).fill(fresh);
  await form.getByRole("option", { name: NEW }).click();
  await line(1).getByLabel("Nom de la nouvelle marchandise").fill(taken);
  await line(1).getByLabel("Montant (septims)").fill("10");
  await form.getByRole("button", { name: "Confirmer l'achat" }).click();
  await expect(form.locator(ALERT)).toContainText("Il y a déjà une marchandise à ce nom");
  await expect(page).toHaveURL(/\/achat-vente\/achat$/);
  await expect(line(1).getByLabel("Nom de la nouvelle marchandise")).toHaveValue(taken);

  // Switched to a sale, the line becomes an article outside the stock, under the same name.
  await line(1).getByLabel("Nom de la nouvelle marchandise").fill(fresh);
  await page.getByRole("button", { name: "C'est une vente" }).click();
  const sale = page.getByRole("region", { name: "Inscrire une vente" });
  const saleLine = sale.getByRole("group", { name: "Marchandise 1" });
  await expect(saleLine.getByRole("combobox", { name: "Marchandise", exact: true })).toHaveValue(
    "Autre article (hors stock)…",
  );
  await expect(saleLine.getByLabel("Nom de l'article")).toHaveValue(fresh);
  // A sale never offers to create one.
  await saleLine.getByRole("combobox", { name: "Marchandise", exact: true }).fill(fresh);
  await expect(sale.getByRole("option", { name: NEW })).toHaveCount(0);

  // Nothing was created by the refused purchase.
  await page.goto("/inventaire");
  await page.getByLabel("Rechercher une marchandise").fill(fresh);
  await expect(page.getByText("Aucune marchandise ne correspond.")).toBeVisible();
  await page.getByLabel("Rechercher une marchandise").fill(taken);
  await expect(page.getByTestId(`stock-${taken}`).getByTestId("stock-value")).toHaveText("2");
});
