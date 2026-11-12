import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { ShopMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { canActOn } from "@/lib/policies";
import { moveStock } from "@/lib/products";
import { settleEntry } from "@/lib/register";
import { lineMessage } from "@/lib/transaction-kinds";

/** Writing the register: sales, buybacks, cash movements, and undoing them. */

type Actor = Pick<ShopMember, "id" | "role" | "shopId">;

export type TransactionLine = {
  /** null for an article that is not in stock, written under its label. */
  productId: number | null;
  /** The typed label; a stocked merchandise is written under its own name. */
  label: string;
  quantity: number;
  amount: number;
};

/**
 * Records a sale or a purchase of one or more merchandises: one register line
 * each, sharing the client and the notes, written all together or not at
 * all, with their stock movements. Returns the ids of the new lines.
 */
export async function recordLines(
  member: Actor,
  {
    kind,
    counterparty,
    notes,
    tillPending,
    lines,
  }: {
    kind: "vente" | "rachat";
    counterparty: string | null;
    notes: string | null;
    /** The member has not yet put the septims in the till, or taken them out. */
    tillPending: boolean;
    lines: TransactionLine[];
  },
) {
  const at = (i: number, message: string) => lineMessage(lines.length, i, message);
  return getDb().transaction(async (tx) => {
    const written: number[] = [];
    for (const [i, { productId, quantity, amount, label: typed }] of lines.entries()) {
      let label = typed;
      if (productId != null) {
        const [product] = await tx
          .select({ name: schema.products.name })
          .from(schema.products)
          .where(
            and(
              eq(schema.products.id, productId),
              eq(schema.products.shopId, member.shopId),
              eq(schema.products.archived, false),
            ),
          )
          .limit(1);
        if (!product) throw new UserError(at(i, "Marchandise inconnue."));
        label = product.name;
      }
      if (!label) throw new UserError(at(i, "Choisis une marchandise."));
      const [line] = await tx
        .insert(schema.transactions)
        .values({
          shopId: member.shopId,
          kind,
          productId,
          label,
          quantity,
          amount,
          counterparty,
          notes,
          tillPending,
          memberId: member.id,
        })
        .returning({ id: schema.transactions.id });
      if (productId != null) {
        let delta = quantity;
        if (kind === "vente") {
          // A sale goes through even without enough stock: only what is there
          // leaves it, so the stock stops at zero. The movement is written even
          // when nothing leaves, so that cancelling the line knows it.
          const [locked] = await tx
            .select({ stock: schema.products.stock })
            .from(schema.products)
            .where(eq(schema.products.id, productId))
            .for("update");
          delta = -Math.min(quantity, locked.stock);
        }
        const reason = `${kind === "vente" ? "Vente" : "Achat"}${counterparty ? ` · ${counterparty}` : ""}`;
        // Throwing rolls back every line with its movement.
        const moved = await moveStock(tx, member.shopId, productId, delta, member.id, reason, line.id);
        if (!moved.ok) throw new UserError(at(i, moved.error));
      }
      written.push(line.id);
    }
    return written;
  });
}

/** Money in or out of the till alone, with no merchandise. Returns the new line's id. */
export async function recordCashLine(
  member: Actor,
  values: { kind: "entree" | "sortie"; label: string; amount: number; counterparty: string | null; notes: string | null },
) {
  const [line] = await getDb()
    .insert(schema.transactions)
    .values({ ...values, shopId: member.shopId, productId: null, quantity: 1, memberId: member.id })
    .returning({ id: schema.transactions.id });
  return line.id;
}

/**
 * The septims of the entry holding line `id`, waiting for the till, are now
 * in it or out of it. Gérants, or the member who wrote it.
 */
export async function settleLine(member: Actor, id: number) {
  const t = schema.transactions;
  const [line] = await getDb()
    .select({ memberId: t.memberId })
    .from(t)
    .where(and(eq(t.id, id), eq(t.shopId, member.shopId), eq(t.tillPending, true), isNull(t.cancelledAt)))
    .limit(1);
  if (!line) throw new UserError("Cette ligne a déjà été réglée ou annulée.");
  if (!canActOn(member, line)) {
    throw new UserError("Seul un gérant peut valider la ligne de quelqu'un d'autre.");
  }
  await settleEntry(member.shopId, id);
}

/** Cancels a line and puts the stock back. Gérants, or the member who wrote it. */
export async function cancelLine(member: Actor, id: number) {
  const t = schema.transactions;
  await getDb().transaction(async (tx) => {
    const [line] = await tx
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.shopId, member.shopId), isNull(t.cancelledAt)))
      .for("update")
      .limit(1);
    if (!line) throw new UserError("Cette ligne est introuvable ou déjà annulée.");
    if (!canActOn(member, line)) {
      throw new UserError("Seul un gérant peut annuler la ligne d'un autre membre.");
    }
    if (line.productId != null) {
      // What the line really moved: a sale may have taken less than it sold.
      // A line with no movement tied to it (imported from the old app) moved its quantity.
      const [{ moved: linked, count }] = await tx
        .select({
          moved: sql<number>`coalesce(sum(${schema.stockMovements.delta}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.stockMovements)
        .where(
          and(eq(schema.stockMovements.transactionId, line.id), eq(schema.stockMovements.productId, line.productId)),
        );
      const delta = count > 0 ? -linked : line.kind === "vente" ? line.quantity : -line.quantity;
      const reason = `Annulation ${line.kind} n°${line.id}`;
      const moved = await moveStock(tx, member.shopId, line.productId, delta, member.id, reason, line.id);
      // A cancelled buyback whose goods are already gone cannot be undone.
      if (!moved.ok) throw new UserError("Impossible d'annuler : la marchandise rachetée a déjà été vendue.");
    }
    await tx.update(t).set({ cancelledAt: new Date(), cancelledBy: member.id }).where(eq(t.id, id));
  });
}
