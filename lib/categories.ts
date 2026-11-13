import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { getDb, isUniqueViolation, schema, type Tx } from "@/lib/db";
import { UserError } from "@/lib/errors";

/** The one category a new shop starts with. */
export const DEFAULT_CATEGORY = "Autres marchandises";

const DUPLICATE = "Il y a déjà une catégorie à ce nom.";

/**
 * The shop's categories in their order (the order they were created in), with
 * how many merchandises each holds, archived ones included.
 */
export async function shopCategories(shopId: number) {
  const c = schema.productCategories;
  return getDb()
    .select({ id: c.id, name: c.name, hides: c.hides, products: count(schema.products.id) })
    .from(c)
    .leftJoin(schema.products, eq(schema.products.categoryId, c.id))
    .where(eq(c.shopId, shopId))
    .groupBy(c.id)
    .orderBy(asc(c.id));
}

export type ShopCategory = Awaited<ReturnType<typeof shopCategories>>[number];

/** A category of the shop, or a refusal: a form may name one of another shop. */
export async function categoryOf(db: Tx | ReturnType<typeof getDb>, shopId: number, id: number) {
  const c = schema.productCategories;
  const [category] = await db
    .select()
    .from(c)
    .where(and(eq(c.id, id), eq(c.shopId, shopId)))
    .limit(1);
  if (!category) throw new UserError("Catégorie inconnue.");
  return category;
}

/** Gives a shop just opened its first category, inside `tx`. */
export async function insertDefaultCategory(tx: Tx, shopId: number) {
  await tx.insert(schema.productCategories).values({ shopId, name: DEFAULT_CATEGORY });
}

async function refusingDuplicates<T>(write: () => Promise<T>) {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE);
    throw error;
  }
}

export async function addCategory(shopId: number, name: string) {
  await refusingDuplicates(() => getDb().insert(schema.productCategories).values({ shopId, name }));
}

/** Renames a category of the shop; its merchandises and what it does (hides) stay. */
export async function renameCategory(shopId: number, id: number, name: string) {
  const c = schema.productCategories;
  const renamed = await refusingDuplicates(() =>
    getDb()
      .update(c)
      .set({ name })
      .where(and(eq(c.id, id), eq(c.shopId, shopId)))
      .returning({ id: c.id }),
  );
  if (renamed.length === 0) throw new UserError("Catégorie inconnue.");
}

/**
 * Deletes a category of the shop that holds no merchandise, archived ones
 * included. The shop keeps at least one, which every merchandise needs.
 */
export async function deleteCategory(shopId: number, id: number) {
  await getDb().transaction(async (tx) => {
    const c = schema.productCategories;
    const category = await categoryOf(tx, shopId, id);
    // Locks the shop's categories so two deletions can't leave it none.
    const all = await tx.select({ id: c.id }).from(c).where(eq(c.shopId, shopId)).for("update");
    if (all.length <= 1) throw new UserError("La boutique garde au moins une catégorie.");
    const [{ held }] = await tx
      .select({ held: count() })
      .from(schema.products)
      .where(eq(schema.products.categoryId, id));
    if (held > 0) {
      throw new UserError(
        `« ${category.name} » contient encore ${held} marchandise${held > 1 ? "s" : ""} (archivées comprises) : change-les de catégorie d'abord.`,
      );
    }
    await tx.delete(c).where(eq(c.id, id));
  });
}
