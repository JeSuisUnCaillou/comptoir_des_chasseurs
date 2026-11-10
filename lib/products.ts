import "server-only";
import { and, asc, count, desc, eq, gt, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
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

export type MovementFilter = {
  /** Part of the merchandise's name. */
  q?: string;
  memberId?: number;
  direction?: "in" | "out";
  from?: Date;
  to?: Date;
};

function movementConditions(filter: MovementFilter) {
  const m = schema.stockMovements;
  const where: SQL[] = [];
  if (filter.q) where.push(ilike(schema.products.name, `%${filter.q.replace(/[\\%_]/g, "\\$&")}%`));
  if (filter.memberId) where.push(eq(m.memberId, filter.memberId));
  if (filter.direction) where.push(filter.direction === "in" ? gt(m.delta, 0) : lt(m.delta, 0));
  if (filter.from) where.push(gte(m.createdAt, filter.from));
  if (filter.to) where.push(lt(m.createdAt, filter.to));
  return where.length ? and(...where) : undefined;
}

/** Number of stock movements matching the filter. */
export async function movementCount(filter: MovementFilter = {}) {
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.stockMovements)
    .innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
    .where(movementConditions(filter));
  return row.total;
}

export async function recentMovements(
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
    .where(movementConditions(filter))
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
