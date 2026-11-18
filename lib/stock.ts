import "server-only";
import { and, count, desc, eq, gt, gte, lt, sql, type SQL } from "drizzle-orm";
import { getDb, isUniqueViolation, schema, type Tx } from "@/lib/db";
import { categoryOf } from "@/lib/categories";
import type { ShopMember } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { isGerant } from "@/lib/policies";
import { lineMessage } from "@/lib/transaction-kinds";
import { setPrivilegedPrices, type PrivilegedInput } from "@/lib/privileged-groups";
import { activeIn, batchFor, DUPLICATE_MAYBE_ARCHIVED, productNameMatches, type ProductPrices } from "@/lib/products";

/** The shop's stock: movements in and out, by hand or with a register line. */

export type MovementFilter = {
  /** Part of the merchandise's name, or of a game name tied to it. */
  q?: string;
  memberId?: number;
  direction?: "in" | "out";
  from?: Date;
  to?: Date;
};

function movementConditions(shopId: number, filter: MovementFilter) {
  const m = schema.stockMovements;
  const where: SQL[] = [eq(m.shopId, shopId)];
  if (filter.q) where.push(productNameMatches(filter.q));
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

/**
 * The same text for the hand movements one member wrote together: one
 * Mouvement de stock, written in one database transaction, so at the same
 * instant. They show as one entry. Null for the movement of a register line
 * (a sale, a buyback, a cancellation), which stays a row of its own.
 */
export function movementEntryKey() {
  const m = schema.stockMovements;
  return sql<string | null>`case when ${m.transactionId} is null then (${m.memberId}, ${m.createdAt})::text end`;
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
      entryKey: movementEntryKey(),
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

type MoveResult = { ok: true; stock: number; id: number } | { ok: false; error: string };

/**
 * Adds `delta` units to a product of the shop and records the movement, tied
 * to the register line that caused it when there is one.
 * Refuses to go below zero, and a product of another shop. With `clamp`, a
 * removal takes only what is left instead of refusing: the stock stops at zero
 * and the movement records what really left (possibly 0). Runs inside the
 * given transaction.
 */
export async function moveStock(
  tx: Tx,
  shopId: number,
  productId: number,
  delta: number,
  memberId: number,
  reason: string,
  transactionId: number | null = null,
  { clamp = false }: { clamp?: boolean } = {},
): Promise<MoveResult> {
  if (clamp && delta < 0) {
    const [locked] = await tx
      .select({ stock: schema.products.stock })
      .from(schema.products)
      .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId)))
      .for("update");
    if (!locked) return { ok: false, error: "Marchandise inconnue." };
    delta = -Math.min(-delta, locked.stock);
  }
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
  const [movement] = await tx
    .insert(schema.stockMovements)
    .values({ shopId, productId, delta, stockAfter: updated.stock, memberId, reason, transactionId })
    .returning({ id: schema.stockMovements.id });
  return { ok: true, stock: updated.stock, id: movement.id };
}

type Actor = Pick<ShopMember, "id" | "shopId">;

/** A stock movement entered by hand on the Inventaire (a hunt, a loss…). */
export async function recordMovement(member: Actor, productId: number, delta: number, reason: string) {
  return getDb().transaction((tx) => moveStock(tx, member.shopId, productId, delta, member.id, reason));
}

/**
 * Several merchandises in or out of stock at once, with one reason and no
 * money: written all together or not at all, in one database transaction, so
 * they share their instant and show as one entry. Returns the movements' ids.
 */
export async function recordMovements(
  member: Actor,
  direction: "in" | "out",
  lines: { productId: number; quantity: number }[],
  reason: string,
) {
  return getDb().transaction(async (tx) => {
    const written: number[] = [];
    for (const [i, { productId, quantity }] of lines.entries()) {
      const [product] = await tx
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(
          and(eq(schema.products.id, productId), activeIn(member.shopId)),
        )
        .limit(1);
      if (!product) throw new UserError(lineMessage(lines.length, i, "Marchandise inconnue."));
      const delta = direction === "in" ? quantity : -quantity;
      // Throwing rolls back every movement already written.
      const moved = await moveStock(tx, member.shopId, productId, delta, member.id, reason);
      if (!moved.ok) throw new UserError(lineMessage(lines.length, i, moved.error));
      written.push(moved.id);
    }
    return written;
  });
}

/**
 * Creates a merchandise and records its first entry in stock, together.
 * `prices` are set at once when given, which only a gérant may do.
 */
export async function createStocked(
  member: Pick<ShopMember, "id" | "shopId" | "role">,
  identity: { name: string; categoryId: number; unit: string },
  prices: { prices: ProductPrices; privileged: PrivilegedInput } | null,
  quantity: number,
  reason: string,
) {
  if (prices && !isGerant(member)) throw new UserError("Seul un gérant fixe les prix.");
  try {
    await getDb().transaction(async (tx) => {
      const category = await categoryOf(tx, member.shopId, identity.categoryId);
      const [product] = await tx
        .insert(schema.products)
        .values({ ...identity, ...(prices && batchFor(category, prices.prices)), shopId: member.shopId })
        .returning({ id: schema.products.id });
      if (prices) await setPrivilegedPrices(tx, member.shopId, product.id, prices.privileged);
      const result = await moveStock(tx, member.shopId, product.id, quantity, member.id, reason);
      if (!result.ok) throw new UserError(result.error);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE_MAYBE_ARCHIVED);
    throw error;
  }
}
