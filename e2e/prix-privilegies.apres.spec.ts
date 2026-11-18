import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { CITIZENS, newEmployeePage, setPrivilegedPrice } from "./helpers";

// Changes the seeded leather, which the other specs read: after them, alone.
test.describe.configure({ mode: "serial" });

async function withDb<T>(run: (sql: postgres.Sql) => Promise<T>) {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    return await run(sql);
  } finally {
    await sql.end();
  }
}

/** The citizens' price of the comptoir's leather, or null without one. */
async function leatherPrice(): Promise<number | null> {
  const rows = await withDb(
    (sql) => sql`
      select pp.buy_price from privileged_prices pp
      join products p on p.id = pp.product_id
      join privileged_groups g on g.id = pp.group_id
      where p.shop_id = 1 and p.name = 'Cuir' and g.name = ${CITIZENS}`,
  );
  return rows.length ? Number(rows[0].buy_price) : null;
}

/** Puts the leather's citizens' price back as the test found it. */
async function restoreLeatherPrice(price: number | null) {
  if (price != null) return setPrivilegedPrice("Cuir", price);
  await withDb(
    (sql) => sql`
      delete from privileged_prices pp using products p, privileged_groups g
      where p.id = pp.product_id and g.id = pp.group_id
        and p.shop_id = 1 and p.name = 'Cuir' and g.name = ${CITIZENS}`,
  );
}

test("le prix privilégié du produit phare a sa propre tuile sur les Tarifs", async ({ browser }) => {
  // The seeded leather, which other tests measure: changed here, after them, and put back.
  const before = await leatherPrice();
  await setPrivilegedPrice("Cuir", 5);
  try {
    const { page } = await newEmployeePage(browser, "ralof");
    await page.getByRole("link", { name: "Tarifs" }).click();
    const leather = page.getByRole("region", { name: "Cuir", exact: true });
    await expect(leather).toContainText("Rachat · autres vendeurs4 septims");
    await expect(leather.getByTestId("rachat-phare-privilegie")).toHaveText(`Rachat · ${CITIZENS}5 septims`);
    // One line: the privileged price first, then the others', the sale, the blacksmith's.
    const box = async (label: string) => (await leather.locator(".stat").filter({ hasText: label }).boundingBox())!;
    const order = [CITIZENS, "autres vendeurs", "Vente", "Rachat par le forgeron"];
    const boxes = await Promise.all(order.map(box));
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y).toBe(boxes[0].y);
      expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x);
    }
  } finally {
    await restoreLeatherPrice(before);
  }
});
