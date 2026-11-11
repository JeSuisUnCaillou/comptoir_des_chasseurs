import "server-only";
import { and, asc, count, desc, eq, gt, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
import { byName, containing, getDb, isUniqueViolation, schema } from "@/lib/db";
import type { ProductCategory } from "@/lib/db/schema";
import type { ShopMember } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { PAGE_SIZE, offsetOf } from "@/lib/pagination";
import { lineMessage } from "@/lib/transaction-kinds";

export const DUPLICATE_PRODUCT_NAME = "Une marchandise porte déjà ce nom.";

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
  if (filter.q) where.push(ilike(schema.products.name, containing(filter.q)));
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
 * The same text for the movements one member wrote together: one database
 * transaction (a multi-line Mouvement de stock, or the lines of a sale), so
 * the same instant. They show as one entry.
 */
export function movementEntryKey() {
  const m = schema.stockMovements;
  return sql<string>`(${m.memberId}, ${m.createdAt})::text`;
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

export type MoveResult = { ok: true; stock: number; id: number } | { ok: false; error: string };

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
          and(
            eq(schema.products.id, productId),
            eq(schema.products.shopId, member.shopId),
            eq(schema.products.archived, false),
          ),
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
 * Creates a merchandise that does not exist yet, without prices, and records
 * its first entry in stock.
 */
export async function createStocked(
  member: Actor,
  identity: { name: string; category: ProductCategory; unit: string },
  quantity: number,
  reason: string,
) {
  try {
    await getDb().transaction(async (tx) => {
      const [product] = await tx
        .insert(schema.products)
        .values({ ...identity, shopId: member.shopId })
        .returning({ id: schema.products.id });
      const result = await moveStock(tx, member.shopId, product.id, quantity, member.id, reason);
      if (!result.ok) throw new UserError(result.error);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UserError(`${DUPLICATE_PRODUCT_NAME} Elle est peut-être archivée : voir Gérer les tarifs.`);
    }
    throw error;
  }
}

/** What Gérer les tarifs sets on a merchandise. */
export type ProductValues = Omit<typeof schema.products.$inferInsert, "id" | "shopId" | "stock" | "createdAt">;

/** Creates a merchandise of the shop, or updates it when `id` is given. */
export async function saveProduct(shopId: number, id: number | null, values: ProductValues) {
  const db = getDb();
  try {
    if (id != null) {
      await db
        .update(schema.products)
        .set(values)
        .where(and(eq(schema.products.id, id), eq(schema.products.shopId, shopId)));
    } else {
      await db.insert(schema.products).values({ ...values, shopId });
    }
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE_PRODUCT_NAME);
    throw error;
  }
}

export async function setBlacksmithLeatherPrice(shopId: number, value: number) {
  await getDb()
    .insert(schema.settings)
    .values({ shopId, key: BLACKSMITH_LEATHER_PRICE, value })
    .onConflictDoUpdate({ target: [schema.settings.shopId, schema.settings.key], set: { value } });
}

/** One page of the shop's catalogue, archived goods last, each part by name; `q` is part of the name. */
export async function productPage(shopId: number, q: string, page: number) {
  const inShop = eq(schema.products.shopId, shopId);
  const where = q ? and(inShop, ilike(schema.products.name, containing(q))) : inShop;
  const db = getDb();
  const [products, [{ total }]] = await Promise.all([
    db
      .select()
      .from(schema.products)
      .where(where)
      .orderBy(asc(schema.products.archived), byName(schema.products.name), asc(schema.products.id))
      .limit(PAGE_SIZE)
      .offset(offsetOf(page)),
    db.select({ total: count() }).from(schema.products).where(where),
  ]);
  return { products, total };
}

/** A merchandise of the shop, archived or not, or undefined. */
export async function productOf(shopId: number, id: number) {
  const [product] = await getDb()
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.id, id), eq(schema.products.shopId, shopId)))
    .limit(1);
  return product;
}
