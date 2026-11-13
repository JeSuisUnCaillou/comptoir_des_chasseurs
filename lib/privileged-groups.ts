import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { getDb, isUniqueViolation, schema } from "@/lib/db";
import type { Product } from "@/lib/db/schema";
import { UserError } from "@/lib/errors";

/**
 * A shop's privileged groups: sellers it buys back from at their own prices,
 * such as the citizens of Estemarche, and each merchandise's price for them.
 */

export type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** A privileged group's buyback price for a merchandise, for its buyQty units. */
export type PrivilegedPrice = { groupId: number; name: string; price: number };

/** A merchandise with the buyback prices of the shop's privileged groups that have one, in the groups' order. */
export type ShopProduct = Product & { privileged: PrivilegedPrice[] };

/** Gives each product its privileged prices. */
export async function withPrivilegedPrices(products: Product[]): Promise<ShopProduct[]> {
  if (products.length === 0) return [];
  const rows = await getDb()
    .select({
      productId: schema.privilegedPrices.productId,
      groupId: schema.privilegedGroups.id,
      name: schema.privilegedGroups.name,
      price: schema.privilegedPrices.buyPrice,
    })
    .from(schema.privilegedPrices)
    .innerJoin(schema.privilegedGroups, eq(schema.privilegedGroups.id, schema.privilegedPrices.groupId))
    .where(inArray(schema.privilegedPrices.productId, products.map((p) => p.id)))
    .orderBy(asc(schema.privilegedGroups.id));
  return products.map((p) => ({
    ...p,
    privileged: rows.filter((r) => r.productId === p.id).map(({ groupId, name, price }) => ({ groupId, name, price })),
  }));
}

/** The shop's privileged groups, oldest first. */
export async function privilegedGroups(shopId: number) {
  return getDb()
    .select()
    .from(schema.privilegedGroups)
    .where(eq(schema.privilegedGroups.shopId, shopId))
    .orderBy(asc(schema.privilegedGroups.id));
}

/** How many privileged groups a shop may have, to keep the forms readable. */
export const MAX_PRIVILEGED_GROUPS = 5;

const DUPLICATE_GROUP_NAME = "La boutique a déjà un groupe à ce nom.";

/** A gérant adds a privileged group to the shop. */
export async function createPrivilegedGroup(shopId: number, name: string) {
  try {
    await getDb().transaction(async (tx) => {
      // Locks the shop's row so that two additions at once can't both pass the cap.
      await tx.select({ id: schema.shops.id }).from(schema.shops).where(eq(schema.shops.id, shopId)).for("update");
      const [{ total }] = await tx
        .select({ total: count() })
        .from(schema.privilegedGroups)
        .where(eq(schema.privilegedGroups.shopId, shopId));
      if (total >= MAX_PRIVILEGED_GROUPS) {
        throw new UserError(`Une boutique a ${MAX_PRIVILEGED_GROUPS} groupes au plus.`);
      }
      await tx.insert(schema.privilegedGroups).values({ shopId, name });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE_GROUP_NAME);
    throw error;
  }
}

/** A gérant renames one of the shop's privileged groups; its prices stay. */
export async function renamePrivilegedGroup(shopId: number, id: number, name: string) {
  try {
    const [renamed] = await getDb()
      .update(schema.privilegedGroups)
      .set({ name })
      .where(and(eq(schema.privilegedGroups.id, id), eq(schema.privilegedGroups.shopId, shopId)))
      .returning({ id: schema.privilegedGroups.id });
    if (!renamed) throw new UserError("Groupe inconnu.");
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE_GROUP_NAME);
    throw error;
  }
}

/** A gérant removes one of the shop's privileged groups, and its prices with it. */
export async function deletePrivilegedGroup(shopId: number, id: number) {
  const [deleted] = await getDb()
    .delete(schema.privilegedGroups)
    .where(and(eq(schema.privilegedGroups.id, id), eq(schema.privilegedGroups.shopId, shopId)))
    .returning({ id: schema.privilegedGroups.id });
  if (!deleted) throw new UserError("Groupe inconnu.");
}

/** Prices a form gives for privileged groups; a null price removes the group's price. */
export type PrivilegedInput = { groupId: number; buyPrice: number | null }[];

/** Sets a merchandise's privileged prices, for the shop's own groups only. */
export async function setPrivilegedPrices(tx: Tx, shopId: number, productId: number, prices: PrivilegedInput) {
  if (prices.length === 0) return;
  const groups = await tx
    .select({ id: schema.privilegedGroups.id })
    .from(schema.privilegedGroups)
    .where(
      and(
        eq(schema.privilegedGroups.shopId, shopId),
        inArray(schema.privilegedGroups.id, prices.map((p) => p.groupId)),
      ),
    );
  const ours = new Set(groups.map((g) => g.id));
  const given = prices.filter((p) => ours.has(p.groupId));
  if (given.length === 0) return;
  await tx.delete(schema.privilegedPrices).where(
    and(
      eq(schema.privilegedPrices.productId, productId),
      inArray(schema.privilegedPrices.groupId, given.map((p) => p.groupId)),
    ),
  );
  const set = given.flatMap((p) => (p.buyPrice == null ? [] : [{ productId, groupId: p.groupId, buyPrice: p.buyPrice }]));
  if (set.length > 0) await tx.insert(schema.privilegedPrices).values(set);
}
