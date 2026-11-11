import "server-only";
import { and, asc, count, desc, eq, gt, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
import { byName, getDb, schema } from "@/lib/db";
import { productCategory, type ProductCategory } from "@/lib/db/schema";

export const DUPLICATE_PRODUCT_NAME = "Une marchandise porte déjà ce nom.";

/**
 * Reads a merchandise's name, category and unit from a form, the same way for
 * every form that creates one. `error` says what is wrong, if anything.
 */
export function readProductIdentity(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const category = String(formData.get("category")) as ProductCategory;
  const unit = String(formData.get("unit") ?? "").trim().slice(0, 30) || "pièce";
  const error = !name
    ? "Le nom est obligatoire."
    : !productCategory.enumValues.includes(category)
      ? "Catégorie inconnue."
      : undefined;
  return { name, category, unit, error };
}

export async function activeProducts(shopId: number) {
  return getDb()
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.shopId, shopId), eq(schema.products.archived, false)))
    .orderBy(byName(schema.products.name), asc(schema.products.id));
}

export async function blacksmithLeatherPrice(shopId: number) {
  const [row] = await getDb()
    .select()
    .from(schema.settings)
    .where(and(eq(schema.settings.shopId, shopId), eq(schema.settings.key, BLACKSMITH_LEATHER_PRICE)))
    .limit(1);
  return row?.value ?? 6;
}

/** Settings key of the price the blacksmith pays for a leather. */
export const BLACKSMITH_LEATHER_PRICE = "prix_forgeron_cuir";

export type MovementFilter = {
  /** Part of the merchandise's name. */
  q?: string;
  memberId?: number;
  direction?: "in" | "out";
  from?: Date;
  to?: Date;
};

function movementConditions(shopId: number, filter: MovementFilter) {
  const m = schema.stockMovements;
  const where: SQL[] = [eq(m.shopId, shopId)];
  if (filter.q) where.push(ilike(schema.products.name, `%${filter.q.replace(/[\\%_]/g, "\\$&")}%`));
  if (filter.memberId) where.push(eq(m.memberId, filter.memberId));
  if (filter.direction) where.push(filter.direction === "in" ? gt(m.delta, 0) : lt(m.delta, 0));
  if (filter.from) where.push(gte(m.createdAt, filter.from));
  if (filter.to) where.push(lt(m.createdAt, filter.to));
  return and(...where);
}

/** Number of stock movements matching the filter. */
export async function movementCount(shopId: number, filter: MovementFilter = {}) {
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.stockMovements)
    .innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
    .where(movementConditions(shopId, filter));
  return row.total;
}

export async function recentMovements(
  shopId: number,
  filter: MovementFilter,
  { limit, offset = 0 }: { limit: number; offset?: number },
) {
  return getDb()
    .select({
      id: schema.stockMovements.id,
      createdAt: schema.stockMovements.createdAt,
      product: schema.products.name,
      unit: schema.products.unit,
      delta: schema.stockMovements.delta,
      stockAfter: schema.stockMovements.stockAfter,
      member: schema.members.name,
      reason: schema.stockMovements.reason,
    })
    .from(schema.stockMovements)
    .innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
    .innerJoin(schema.members, eq(schema.members.id, schema.stockMovements.memberId))
    .where(movementConditions(shopId, filter))
    .orderBy(desc(schema.stockMovements.createdAt), desc(schema.stockMovements.id))
    .limit(limit)
    .offset(offset);
}

export type Movement = Awaited<ReturnType<typeof recentMovements>>[number];

export type MoveResult = { ok: true; stock: number } | { ok: false; error: string };

/**
 * Adds `delta` units to a product of the shop and records the movement, tied
 * to the register line that caused it when there is one.
 * Refuses to go below zero, and a product of another shop. Runs inside the
 * given transaction.
 */
export async function moveStock(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  shopId: number,
  productId: number,
  delta: number,
  memberId: number,
  reason: string,
  transactionId: number | null = null,
): Promise<MoveResult> {
  const [updated] = await tx
    .update(schema.products)
    .set({ stock: sql`${schema.products.stock} + ${delta}` })
    .where(
      and(
        eq(schema.products.id, productId),
        eq(schema.products.shopId, shopId),
        sql`${schema.products.stock} + ${delta} >= 0`,
      ),
    )
    .returning({ stock: schema.products.stock });
  if (!updated) return { ok: false, error: "Stock insuffisant pour cette sortie." };
  await tx.insert(schema.stockMovements).values({
    shopId,
    productId,
    delta,
    stockAfter: updated.stock,
    memberId,
    reason,
    transactionId,
  });
  return { ok: true, stock: updated.stock };
}
