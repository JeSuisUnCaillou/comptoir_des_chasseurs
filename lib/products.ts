import "server-only";
import { and, asc, count, eq, exists, getTableColumns, ilike, isNotNull, or } from "drizzle-orm";
import { byName, containing, getDb, isUniqueViolation, schema } from "@/lib/db";
import { categoryOf } from "@/lib/categories";
import { UserError } from "@/lib/errors";
import { PAGE_SIZE, offsetOf } from "@/lib/pagination";
import { normalizeName } from "@/lib/game-count";
import { setPrivilegedPrices, withPrivilegedPrices, type PrivilegedInput, type ShopProduct } from "@/lib/privileged-groups";

/** The shop's catalogue: its merchandises, their prices and which are put forward. */

const DUPLICATE_PRODUCT_NAME = "Il y a déjà une marchandise à ce nom.";
/** A merchandise created where the archived ones are not shown. */
export const DUPLICATE_MAYBE_ARCHIVED = `${DUPLICATE_PRODUCT_NAME} Elle est peut-être archivée : regarde dans « Gérer les marchandises ».`;

/** A merchandise's columns, with its category's name and whether it holds hides. */
const withCategory = {
  ...getTableColumns(schema.products),
  categoryName: schema.productCategories.name,
  hides: schema.productCategories.hides,
  categoryPosition: schema.productCategories.position,
};

export type CategorizedProduct = Awaited<ReturnType<typeof activeProducts>>[number];

/** The shop's merchandises still sold, each with the game names tied to it (`aliases`, normalized) for searches. */
export async function activeProducts(shopId: number) {
  const [products, aliases] = await Promise.all([
    getDb()
      .select(withCategory)
      .from(schema.products)
      .innerJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
      .where(and(eq(schema.products.shopId, shopId), eq(schema.products.archived, false)))
      .orderBy(byName(schema.products.name), asc(schema.products.id)),
    productAliases(shopId),
  ]);
  const priced = await withPrivilegedPrices(products);
  return priced.map((p) => ({
    ...p,
    aliases: aliases.filter((a) => a.productId === p.id).map((a) => a.name),
  }));
}

/**
 * A merchandise of the outer query (`products`) answers a search: its name
 * contains `q`, or one of the game names tied to it does (see matchesSearch,
 * lib/product-search.ts, the same rule for lists filtered in the browser).
 */
export function productNameMatches(q: string) {
  const byOwnName = ilike(schema.products.name, containing(q));
  const key = normalizeName(q);
  if (!key) return byOwnName;
  const a = schema.productAliases;
  return or(
    byOwnName,
    exists(
      getDb()
        .select({ one: a.productId })
        .from(a)
        .where(and(eq(a.productId, schema.products.id), ilike(a.name, containing(key)))),
    ),
  )!;
}

/** The products the Tarifs page puts forward, among the given active ones, in the order gérants set. */
export function featuredProducts<P extends { id: number; featuredAt: Date | null }>(active: P[]) {
  return active
    .filter((p) => p.featuredAt != null)
    .sort((a, b) => a.featuredAt!.getTime() - b.featuredAt!.getTime() || a.id - b.id);
}

/**
 * The shop's merchandise that may still be sold, bought, moved or put forward:
 * of this shop, and not archived. Every write about a merchandise checks it here.
 */
export function activeIn(shopId: number) {
  return and(eq(schema.products.shopId, shopId), eq(schema.products.archived, false));
}

/** Puts one of the shop's active products forward on the Tarifs page, after the others, or takes it back. */
export async function setFeatured(shopId: number, productId: number, featured: boolean) {
  const [product] = await getDb()
    .update(schema.products)
    .set({ featuredAt: featured ? new Date() : null })
    .where(
      and(eq(schema.products.id, productId), activeIn(shopId)),
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

/** What Gérer les marchandises sets on a merchandise. */
type ProductValues = Omit<
  typeof schema.products.$inferInsert,
  "id" | "shopId" | "stock" | "createdAt" | "category" | "leather"
> & { categoryId: number };

/** A merchandise's prices, without its name, category, unit or archiving. */
export type ProductPrices = Omit<ProductValues, "name" | "categoryId" | "unit" | "archived">;

/** The prices as saved: only a merchandise of the hides' category turns into leather by batches. */
export function batchFor<P extends ProductPrices>(category: { hides: boolean }, prices: P): P {
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

/** One page of the shop's catalogue, archived goods last, each part by name; `q` is part of the name or of a game name tied to it. */
export async function productPage(shopId: number, q: string, page: number) {
  const inShop = eq(schema.products.shopId, shopId);
  const where = q ? and(inShop, productNameMatches(q)) : inShop;
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

/** The game's names the shop tied to its merchandises, normalized. */
async function productAliases(shopId: number) {
  return getDb()
    .select({ name: schema.productAliases.name, productId: schema.productAliases.productId })
    .from(schema.productAliases)
    .where(eq(schema.productAliases.shopId, shopId));
}
