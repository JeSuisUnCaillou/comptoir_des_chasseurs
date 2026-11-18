import { expect, test, type Page } from "@playwright/test";
import { openShop, uniqueName } from "./helpers";

async function cashMovement(page: Page, shop: string, direction: string, amount: string, motif: string, pending: boolean) {
  await page.goto(`${shop}/achat-vente/caisse`);
  const form = page.getByRole("region", { name: "Inscrire un mouvement de caisse" });
  await form.getByRole("radio", { name: direction }).check();
  await form.getByLabel("Montant (septims)").fill(amount);
  await form.getByLabel("Motif").fill(motif);
  if (pending) await form.getByLabel("Pas encore mis en caisse").check();
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page.getByRole("status")).toContainText(`Mouvement inscrit : ${motif}`);
}

test("le montant compté dans le coffre remplit le sens et l'écart du mouvement de caisse", async ({ browser }) => {
  // A shop of its own: no other test moves its till.
  const page = await (await browser.newContext()).newPage();
  const shop = await openShop(page, uniqueName("Coffre"));
  // 100 septims in the till, and 9 waiting for it.
  await cashMovement(page, shop, "Entrée d'argent", "100", uniqueName("Caisse de départ"), false);
  await cashMovement(page, shop, "Entrée d'argent", "9", uniqueName("Apport du gérant"), true);

  await page.goto(`${shop}/achat-vente/caisse`);
  const form = page.getByRole("region", { name: "Inscrire un mouvement de caisse" });
  // Lines not yet in the till are pointed out before counting.
  const waiting = form.getByTestId("caisse-en-attente");
  await expect(waiting).toContainText("Des écritures ne sont pas encore en caisse");
  const counted = form.getByLabel(/J'ai compté dans le coffre/);
  const amount = form.getByLabel("Montant (septims)");
  const preview = form.getByTestId("apercu-caisse");
  await expect(preview).toHaveText("Caisse actuelle : 100 septims");

  // More in the coffer than in the till: money in, for the gap.
  await counted.fill("220");
  await expect(form.getByRole("radio", { name: "Entrée d'argent" })).toBeChecked();
  await expect(amount).toHaveValue("120");
  await expect(form.getByLabel("Motif")).toHaveValue("Correction de caisse");
  await expect(preview).toHaveText("Caisse actuelle : 100 septims → après : 220 septims");

  // Less: money out.
  await counted.fill("93");
  await expect(form.getByRole("radio", { name: "Sortie d'argent" })).toBeChecked();
  await expect(amount).toHaveValue("7");

  // The same: nothing to write.
  await counted.fill("100");
  await expect(form.getByText("La caisse est juste : rien à inscrire.")).toBeVisible();
  await expect(amount).toHaveValue("");

  // An amount changed by hand no longer says what was counted.
  await counted.fill("115");
  await amount.fill("20");
  await expect(counted).toHaveValue("");

  // Written, the gap is a movement like any other.
  const motif = uniqueName("Comptage du coffre");
  await counted.fill("115");
  await expect(amount).toHaveValue("15");
  await form.getByLabel("Motif").fill(motif);
  await form.getByRole("button", { name: "Inscrire le mouvement" }).click();
  await expect(page.getByRole("status")).toHaveText(`Mouvement inscrit : ${motif}, +15 septims.`);

  // The warning leads to the lines waiting for the till.
  await page.goto(`${shop}/achat-vente/caisse`);
  await waiting.getByRole("link", { name: "valide ou annule-les" }).click();
  await expect(page).toHaveURL(/type=attente/);
});
