import { expect, test } from "@playwright/test";
import { createProduct, newEmployeePage, uniqueName } from "./helpers";

test("ajouter une marchandise met le curseur dans le choix de la nouvelle ligne", async ({ browser }) => {
  const product = uniqueName("Peau de renard");
  await createProduct(product, { stock: 4 });
  const { page } = await newEmployeePage(browser, "curseur");
  for (const [url, region] of [
    ["/inventaire/mouvement", "Inscrire un mouvement de stock"],
    ["/achat-vente/achat", "Inscrire un achat"],
    ["/achat-vente/vente", "Inscrire une vente"],
  ] as const) {
    await page.goto(url);
    const form = page.getByRole("region", { name: region });
    await form.getByRole("button", { name: "Ajouter une marchandise" }).click();
    const box = form.getByRole("group", { name: "Marchandise 2" }).getByRole("combobox", { name: "Marchandise" });
    await expect(box).toBeFocused();
    // The list waits for the member to type: open, it would cover the button just clicked.
    await expect(form.getByRole("listbox")).toHaveCount(0);
    // The member types straight away and picks the product.
    await page.keyboard.type(product.slice(-10));
    await page.keyboard.press("Enter");
    await expect(box).toHaveValue(product);
  }
});
