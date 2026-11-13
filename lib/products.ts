import "server-only";
import { and, asc, count, desc, eq, getTableColumns, gt, gte, ilike, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { byName, containing, getDb, isUniqueViolation, schema } from "@/lib/db";
import { categoryOf } from "@/lib/categories";
import type { ShopMember } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { PAGE_SIZE, offsetOf } from "@/lib/pagination";
import { isGerant } from "@/lib/policies";
import { lineMessage } from "@/lib/transaction-kinds";
import { setPrivilegedPrices, withPrivilegedPrices, type PrivilegedInput, type ShopProduct, type Tx } from "@/lib/privileged-groups";

export const DUPLICATE_PRODUCT_NAME = "Il y a déjà une marchandise à ce nom.";

/** A merchandise's columns, with its category's name and whether it holds hides. */
const withCategory = {
  ...getTableColumns(schema.products),
  categoryName: schema.productCategories.name,
  hides: schema.productCategories.hides,
  categoryPosition: schema.productCategories.position,
};

export type CategorizedProduct = Awaited<ReturnType<typeof activeProducts>>[number];

export async function activeProducts(shopId: number) {
  const products = await getDb()
    .select(withCategory)
    .from(schema.products)
    .innerJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
    .where(and(eq(schema.products.shopId, shopId), eq(schema.products.archived, false)))
    .orderBy(byName(schema.products.name), asc(schema.products.id));
  return withPrivilegedPrices(products);
}

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
export const BLACKSMITH_LEATHER_PRICE = "prix_forgeron_cuir";

/** The products the Tarifs page puts forward, among the given active ones, in the order gérants set. */
export function featuredProducts<P extends { id: number; featuredAt: Date | null }>(active: P[]) {
  return active
    .filter((p) => p.featuredAt != null)
    .sort((a, b) => a.featuredAt!.getTime() - b.featuredAt!.getTime() || a.id - b.id);
}

/** Puts one of the shop's active products forward on the Tarifs page, after the others, or takes it back. */
export async function setFeatured(shopId: number, productId: number, featured: boolean) {
  const [product] = await getDb()
    .update(schema.products)
    .set({ featuredAt: featured ? new Date() : null })
    .where(
      and(
        eq(schema.products.id, productId),
        eq(schema.products.shopId, shopId),
        eq(schema.products.archived, false),
      ),
    )
    .returning({ id: schema.products.id });
  if (!product) throw new UserError("Marchandise inconnue.");
}

/** Puts the shop's featured products in the given order on the Tarifs page: all of them, each once. */
export async function setFeaturedOrder(shopId: number, ids: number[]) {
  const p = schema.products;
  await getDb().transaction(async (tx) => {
    const rows = await tx
      .select({ id: p.id, featuredAt: p.featuredAt })
      .from(p)
      .where(and(eq(p.shopId, shopId), eq(p.archived, false), isNotNull(p.featuredAt)))
      .for("update");
    const featured = new Set(rows.map((r) => r.id));
    if (ids.length !== featured.size || new Set(ids).size !== ids.length || !ids.every((id) => featured.has(id))) {
      throw new UserError("La liste des produits phares a changé : recharge la page.");
    }
    // The order is the featured date: the earliest one first, then a millisecond apart.
    const first = Math.min(...rows.map((r) => r.featuredAt!.getTime()));
    for (const [i, id] of ids.entries()) {
      await tx.update(p).set({ featuredAt: new Date(first + i) }).where(eq(p.id, id));
    }
  });
}

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

export type MoveResult = { ok: true; stock: number; id: number } | { ok: false; error: string };

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
    if (isUniqueViolation(error)) {
      throw new UserError(`${DUPLICATE_PRODUCT_NAME} Elle est peut-être archivée : regarde dans « Gérer les marchandises ».`);
    }
    throw error;
  }
}

/** What Gérer les marchandises sets on a merchandise. */
export type ProductValues = Omit<
  typeof schema.products.$inferInsert,
  "id" | "shopId" | "stock" | "createdAt" | "category" | "leather"
> & { categoryId: number };

/** A merchandise's prices, without its name, category, unit or archiving. */
export type ProductPrices = Omit<ProductValues, "name" | "categoryId" | "unit" | "archived">;

/** The prices as saved: only a merchandise of the hides' category turns into leather by batches. */
function batchFor<P extends ProductPrices>(category: { hides: boolean }, prices: P): P {
  return category.hides ? prices : { ...prices, hidesPerBatch: null, leatherPerBatch: null };
}

/** Creates a merchandise of the shop, or updates it when `id` is given. */
export async function saveProduct(
  shopId: number,
  id: number | null,
  given: ProductValues,
  privileged: PrivilegedInput = [],
) {
  const values = batchFor(await categoryOf(getDb(), shopId, given.categoryId), given);
  try {
    await getDb().transaction(async (tx) => {
      const [saved] =
        id != null
          ? await tx
              .update(schema.products)
              .set(values)
              .where(and(eq(schema.products.id, id), eq(schema.products.shopId, shopId)))
              .returning({ id: schema.products.id })
          : await tx.insert(schema.products).values({ ...values, shopId }).returning({ id: schema.products.id });
      if (saved) await setPrivilegedPrices(tx, shopId, saved.id, privileged);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE_PRODUCT_NAME);
    throw error;
  }
}

export async function setBlacksmithLeatherPrice(shopId: number, value: number) {
  await writeSetting(shopId, BLACKSMITH_LEATHER_PRICE, value);
}

/** One page of the shop's catalogue, archived goods last, each part by name; `q` is part of the name. */
export async function productPage(shopId: number, q: string, page: number) {
  const inShop = eq(schema.products.shopId, shopId);
  const where = q ? and(inShop, ilike(schema.products.name, containing(q))) : inShop;
  const db = getDb();
  const [products, [{ total }]] = await Promise.all([
    db
      .select(withCategory)
      .from(schema.products)
      .innerJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
      .where(where)
      .orderBy(asc(schema.products.archived), byName(schema.products.name), asc(schema.products.id))
      .limit(PAGE_SIZE)
      .offset(offsetOf(page)),
    db.select({ total: count() }).from(schema.products).where(where),
  ]);
  return { products, total };
}

/** A merchandise of the shop, archived or not, or undefined. */
export async function productOf(shopId: number, id: number): Promise<ShopProduct | undefined> {
  const [product] = await getDb()
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.id, id), eq(schema.products.shopId, shopId)))
    .limit(1);
  return product && (await withPrivilegedPrices([product]))[0];
}
