import "server-only";
import { and, asc, count, desc, eq, gt, gte, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, isUniqueViolation, schema, type Tx } from "@/lib/db";
import { categoryOf } from "@/lib/categories";
import type { ShopMember } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { isQuantity } from "@/lib/forms";
import { canActOn, isGerant } from "@/lib/policies";
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

/**
 * For a movement by hand, every movement of its entry still counted, and
 * every cancelled one, as "units × merchandise", one per text line; '' for
 * the movement of a register line, whose buttons are on that line.
 */
export function movementStateColumns() {
  const m = schema.stockMovements;
  const items = (cancelled: boolean) =>
    sql<string>`case when ${m.transactionId} is null then coalesce((
      select string_agg(abs(s.delta) || ' × ' || sp.name, E'\n' order by s.id)
      from stock_movements s join products sp on sp.id = s.product_id
      where s.transaction_id is null and s.member_id = ${m.memberId} and s.created_at = ${m.createdAt}
        and s.cancelled_at is ${cancelled ? sql`not null` : sql`null`}), '') else '' end`;
  return { entryActiveItems: items(false), entryCancelledItems: items(true) };
}

const canceller = alias(schema.members, "canceller");
const editor = alias(schema.members, "editor");

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
      memberId: schema.stockMovements.memberId,
      productId: schema.stockMovements.productId,
      transactionId: schema.stockMovements.transactionId,
      cancelledAt: schema.stockMovements.cancelledAt,
      cancelledBy: canceller.name,
      editedBy: editor.name,
      ...movementStateColumns(),
    })
    .from(schema.stockMovements)
    .innerJoin(schema.products, eq(schema.products.id, schema.stockMovements.productId))
    .innerJoin(schema.members, eq(schema.members.id, schema.stockMovements.memberId))
    .leftJoin(canceller, eq(canceller.id, schema.stockMovements.cancelledBy))
    .leftJoin(editor, eq(editor.id, schema.stockMovements.editedBy))
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

/** The movements by hand written together with movement `id`: one Mouvement de stock. */
function sameMovementEntryAs(id: number) {
  const m = schema.stockMovements;
  return sql`${m.transactionId} is null and (${m.memberId}, ${m.createdAt}) = (
    select s.member_id, s.created_at from stock_movements s where s.id = ${id} and s.transaction_id is null)`;
}

/**
 * The movements still counted of the entry by hand holding movement `id`,
 * in the order they were written; none for the movement of a register line.
 */
export async function movementEntryLines(shopId: number, id: number) {
  const m = schema.stockMovements;
  return getDb()
    .select({
      id: m.id,
      productId: m.productId,
      product: schema.products.name,
      unit: schema.products.unit,
      delta: m.delta,
      memberId: m.memberId,
      member: schema.members.name,
      reason: m.reason,
      createdAt: m.createdAt,
    })
    .from(m)
    .innerJoin(schema.products, eq(schema.products.id, m.productId))
    .innerJoin(schema.members, eq(schema.members.id, m.memberId))
    .where(and(eq(m.shopId, shopId), sameMovementEntryAs(id), isNull(m.cancelledAt)))
    .orderBy(asc(m.id));
}

type HandMovement = typeof schema.stockMovements.$inferSelect;

/**
 * Moves the stock of a product by `delta` without writing a movement: the
 * change of a movement already written. Refuses to go below zero, saying what
 * is left.
 */
async function shiftStock(tx: Tx, shopId: number, productId: number, delta: number) {
  const p = schema.products;
  const [product] = await tx
    .select({ stock: p.stock, name: p.name })
    .from(p)
    .where(and(eq(p.id, productId), eq(p.shopId, shopId)))
    .for("update");
  if (!product) return "marchandise inconnue";
  if (product.stock + delta < 0) return `il ne reste que ${product.stock} ${product.name} en stock`;
  await tx.update(p).set({ stock: product.stock + delta }).where(eq(p.id, productId));
  return null;
}

/** The movements by hand to change: movement `id`, or every one of its entry (`whole`) in that state. */
async function lockMovements(tx: Tx, member: Actor, id: number, whole: boolean, cancelled: boolean) {
  const m = schema.stockMovements;
  return tx
    .select()
    .from(m)
    .where(
      and(
        eq(m.shopId, member.shopId),
        isNull(m.transactionId),
        whole ? sameMovementEntryAs(id) : eq(m.id, id),
        cancelled ? isNotNull(m.cancelledAt) : isNull(m.cancelledAt),
      ),
    )
    .orderBy(asc(m.id))
    .for("update");
}

/**
 * Cancels a movement by hand, or every one still counted of its entry
 * (`whole`): what came in goes out, what went out comes back. All of them or
 * none, never below zero. Gérants, or the member who wrote it.
 */
export async function cancelMovements(member: Actor & Pick<ShopMember, "role">, id: number, whole = false) {
  await changeMovements(member, id, whole, "cancel");
}

/** Counts a cancelled movement by hand again, or every cancelled one of its entry (`whole`). */
export async function restoreMovements(member: Actor & Pick<ShopMember, "role">, id: number, whole = false) {
  await changeMovements(member, id, whole, "restore");
}

async function changeMovements(
  member: Actor & Pick<ShopMember, "role">,
  id: number,
  whole: boolean,
  change: "cancel" | "restore",
) {
  const m = schema.stockMovements;
  const cancel = change === "cancel";
  await getDb().transaction(async (tx) => {
    const moves: HandMovement[] = await lockMovements(tx, member, id, whole, !cancel);
    if (moves.length === 0) {
      throw new UserError(`Ce mouvement est introuvable ou déjà ${cancel ? "annulé" : "rétabli"}.`);
    }
    // The movements of one entry share their author.
    if (!canActOn(member, moves[0])) {
      throw new UserError(`Seul un gérant peut ${cancel ? "annuler" : "rétablir"} le mouvement d'un autre membre.`);
    }
    for (const move of moves) {
      const refused = await shiftStock(tx, member.shopId, move.productId, cancel ? -move.delta : move.delta);
      // Throwing keeps every movement as it was.
      if (refused) throw new UserError(`Impossible ${cancel ? "d'annuler" : "de rétablir"} : ${refused}.`);
      await tx
        .update(m)
        .set(cancel ? { cancelledAt: new Date(), cancelledBy: member.id } : { cancelledAt: null, cancelledBy: null })
        .where(eq(m.id, move.id));
    }
  });
}

/**
 * Changes the units of movements still counted of the entry by hand holding
 * movement `id`: `quantities` maps a movement's id to its new units, its
 * direction kept. The stock follows, never below zero; all of them or none.
 * Gérants, or the member who wrote it.
 */
export async function editQuantities(
  member: Actor & Pick<ShopMember, "role">,
  id: number,
  quantities: Map<number, number>,
) {
  const m = schema.stockMovements;
  await getDb().transaction(async (tx) => {
    const moves: HandMovement[] = await lockMovements(tx, member, id, true, false);
    if (moves.length === 0) throw new UserError("Ce mouvement est introuvable ou annulé.");
    if (!canActOn(member, moves[0])) {
      throw new UserError("Seul un gérant peut modifier le mouvement d'un autre membre.");
    }
    const byId = new Map(moves.map((move) => [move.id, move]));
    for (const moveId of quantities.keys()) {
      if (!byId.has(moveId)) throw new UserError("Un mouvement a été annulé entre-temps : recharge la page.");
    }
    for (const [i, move] of moves.entries()) {
      const quantity = quantities.get(move.id);
      if (quantity === undefined || quantity === Math.abs(move.delta)) continue;
      if (!isQuantity(quantity)) {
        throw new UserError(lineMessage(moves.length, i, "La quantité doit être un nombre entier d'au moins 1."));
      }
      const delta = Math.sign(move.delta) * quantity;
      const refused = await shiftStock(tx, member.shopId, move.productId, delta - move.delta);
      if (refused) throw new UserError(lineMessage(moves.length, i, `Impossible : ${refused}.`));
      await tx
        .update(m)
        .set({ delta, stockAfter: move.stockAfter + delta - move.delta, editedAt: new Date(), editedBy: member.id })
        .where(eq(m.id, move.id));
    }
  });
}
