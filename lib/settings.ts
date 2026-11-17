import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** The shop's settings: one number per key, per shop. */

/** A shop setting's value, undefined while it was never saved. */
async function readSetting(shopId: number, key: string) {
  const [row] = await getDb()
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.shopId, shopId), eq(schema.settings.key, key)))
    .limit(1);
  return row?.value;
}

async function writeSetting(shopId: number, key: string, value: number) {
  await getDb()
    .insert(schema.settings)
    .values({ shopId, key, value })
    .onConflictDoUpdate({ target: [schema.settings.shopId, schema.settings.key], set: { value } });
}

export async function blacksmithLeatherPrice(shopId: number) {
  return (await readSetting(shopId, BLACKSMITH_LEATHER_PRICE)) ?? 6;
}

/** Settings key of the price the blacksmith pays for a leather. */
const BLACKSMITH_LEATHER_PRICE = "prix_forgeron_cuir";

export async function setBlacksmithLeatherPrice(shopId: number, value: number) {
  await writeSetting(shopId, BLACKSMITH_LEATHER_PRICE, value);
}
