import "server-only";
import { and, inArray } from "drizzle-orm";
import { byName, getDb, isUniqueViolation, schema, type Tx } from "@/lib/db";
import type { ShopMember } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { normalizeName, sumByProduct } from "@/lib/game-count";
import { isGerant } from "@/lib/policies";
import { activeIn, DUPLICATE_MAYBE_ARCHIVED, insertProduct } from "@/lib/products";
import { moveStock } from "@/lib/stock";

/** Counting a chest from the game: the only writer of the game names tied to merchandises. */

/**
 * An item of a chest counted from the game, tied by the gérant to a
 * merchandise of the shop, or to a new one to create (`newName`).
 */
export type CountLine = { counted: number; readName: string } & (
  | { productId: number }
  | { newName: string; categoryId: number }
);

type TiedLine = { productId: number; counted: number; readName: string };

type CountedProduct = { id: number; name: string; stock: number };

/**
 * Sets the stock of the counted merchandises to what the chest holds, as
 * stock movements with one reason, all together or not at all. The new
 * merchandises are created first, without prices; items tied to the same
 * new name make one. Items tied to the same merchandise add up. A
 * merchandise already at its count gets no movement. Each game name tied to
 * a merchandise other than its own is remembered for the next count.
 * Gérants only. Returns the movements' ids and how many merchandises were created.
 */
export async function recordCount(member: Pick<ShopMember, "id" | "shopId" | "role">, given: CountLine[], reason: string) {
  if (!isGerant(member)) throw new UserError("Seul un gérant compte le stock depuis le jeu.");
  try {
    return await getDb().transaction(async (tx) => {
      const { lines, created } = await createMissing(tx, member.shopId, given);
      const counted = sumByProduct(lines);
      const products = await lockCounted(tx, member.shopId, [...counted.keys()]);
      await rememberAliases(tx, member.shopId, lines, products);
      const written = await settleStock(tx, member, products, counted, reason);
      return { written, created };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE_MAYBE_ARCHIVED);
    throw error;
  }
}

/** Creates the new merchandises, one per normalized new name, and ties every line to a merchandise. */
async function createMissing(tx: Tx, shopId: number, given: CountLine[]) {
  const created = new Map<string, number>();
  const lines: TiedLine[] = [];
  for (const line of given) {
    if ("productId" in line) {
      lines.push(line);
      continue;
    }
    const key = normalizeName(line.newName);
    if (!created.has(key)) {
      created.set(key, await insertProduct(tx, shopId, { name: line.newName, categoryId: line.categoryId }));
    }
    lines.push({ productId: created.get(key)!, counted: line.counted, readName: line.readName });
  }
  return { lines, created: created.size };
}

/** The counted merchandises, locked until the count is written; refuses one gone or archived. */
async function lockCounted(tx: Tx, shopId: number, ids: number[]): Promise<CountedProduct[]> {
  const products = ids.length
    ? await tx
        .select({ id: schema.products.id, name: schema.products.name, stock: schema.products.stock })
        .from(schema.products)
        .where(and(inArray(schema.products.id, ids), activeIn(shopId)))
        .orderBy(byName(schema.products.name))
        .for("update")
    : [];
  if (products.length !== ids.length) throw new UserError("Une marchandise n'existe plus : recharge la page.");
  return products;
}

/** Remembers each game name tied to a merchandise other than its own, for the next count. */
async function rememberAliases(tx: Tx, shopId: number, lines: TiedLine[], products: CountedProduct[]) {
  for (const { productId, readName } of lines) {
    const name = normalizeName(readName);
    const product = products.find((p) => p.id === productId)!;
    if (!name || name === normalizeName(product.name)) continue;
    await tx
      .insert(schema.productAliases)
      .values({ shopId, name, productId })
      .onConflictDoUpdate({ target: [schema.productAliases.shopId, schema.productAliases.name], set: { productId } });
  }
}

/** Moves each merchandise's stock to its count; returns the movements' ids. */
async function settleStock(
  tx: Tx,
  member: Pick<ShopMember, "id" | "shopId">,
  products: CountedProduct[],
  counted: Map<number, number>,
  reason: string,
) {
  const written: number[] = [];
  for (const product of products) {
    const delta = counted.get(product.id)! - product.stock;
    if (delta === 0) continue;
    const moved = await moveStock(tx, member.shopId, product.id, delta, member.id, reason);
    if (!moved.ok) throw new UserError(`${product.name} : ${moved.error}`);
    written.push(moved.id);
  }
  return written;
}
