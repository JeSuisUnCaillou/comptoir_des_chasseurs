import "server-only";
import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { byName, getDb, schema } from "@/lib/db";

export async function activeProducts() {
  return getDb()
    .select()
    .from(schema.products)
    .where(eq(schema.products.archived, false))
    .orderBy(byName(schema.products.name), asc(schema.products.id));
}

export async function blacksmithLeatherPrice() {
  const [row] = await getDb()
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "prix_forgeron_cuir"))
    .limit(1);
  return row?.value ?? 6;
}

export async function movementCount() {
  const [row] = await getDb().select({ total: count() }).from(schema.stockMovements);
  return row.total;
}

export async function recentMovements({ limit, offset = 0 }: { limit: number; offset?: number }) {
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
    .orderBy(desc(schema.stockMovements.createdAt), desc(schema.stockMovements.id))
    .limit(limit)
    .offset(offset);
}

export type MoveResult = { ok: true; stock: number } | { ok: false; error: string };

/**
 * Adds `delta` units to a product's stock and records the movement.
 * Refuses to go below zero. Runs inside the given transaction if any.
 */
export async function moveStock(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  productId: number,
  delta: number,
  memberId: number,
  reason: string,
): Promise<MoveResult> {
  const [updated] = await tx
    .update(schema.products)
    .set({ stock: sql`${schema.products.stock} + ${delta}` })
    .where(and(eq(schema.products.id, productId), sql`${schema.products.stock} + ${delta} >= 0`))
    .returning({ stock: schema.products.stock });
  if (!updated) return { ok: false, error: "Stock insuffisant pour cette sortie." };
  await tx.insert(schema.stockMovements).values({
    productId,
    delta,
    stockAfter: updated.stock,
    memberId,
    reason,
  });
  return { ok: true, stock: updated.stock };
}
