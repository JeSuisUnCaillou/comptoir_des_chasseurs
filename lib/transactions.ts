import "server-only";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { ShopMember } from "@/lib/auth/session";
import { getDb, isUniqueViolation, schema, type Tx } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { contactSide } from "@/lib/contact-kind";
import { canActOn } from "@/lib/policies";
import { activeIn, DUPLICATE_MAYBE_ARCHIVED, insertProduct, type ProductIdentity } from "@/lib/products";
import { moveStock } from "@/lib/stock";
import { cancelStockDelta, clearStockReminder, sameEntryAs, settleEntry } from "@/lib/register";
import { contactNamed, createContactFromTransaction } from "@/lib/suppliers";
import { isCashKind, lineMessage } from "@/lib/transaction-kinds";

/** Writing the register: sales, buybacks, cash movements, and undoing them. */

type Actor = Pick<ShopMember, "id" | "role" | "shopId">;

export type TransactionLine = {
  /** null for an article that is not in stock, written under its label, or for `newProduct`. */
  productId: number | null;
  /** On a purchase, a merchandise the shop does not know yet: created without prices, then bought into stock. */
  newProduct?: ProductIdentity;
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
    counterparty: typedName,
    notes,
    tillPending,
    stockReminder = false,
    lines,
  }: {
    kind: "vente" | "rachat";
    counterparty: string | null;
    notes: string | null;
    /** The member has not yet put the septims in the till, or taken them out. */
    tillPending: boolean;
    /** On a purchase, remind the member to put the merchandise in the chest. */
    stockReminder?: boolean;
    lines: TransactionLine[];
  },
) {
  const at = (i: number, message: string) => lineMessage(lines.length, i, message);
  try {
    return await getDb().transaction(async (tx) => {
      // A known contact is written as they spell their name; an unknown name becomes a contact, below.
      const known = typedName && (await contactNamed(tx, member.shopId, typedName));
      const counterparty = known || typedName;
      const written: number[] = [];
      // Each line with the merchandise it moves, new ones included, for the contact's offers.
      const tied: TransactionLine[] = [];
      for (const [i, { newProduct, productId: chosen, quantity, amount, label: typed }] of lines.entries()) {
        let productId = chosen;
        let label = typed;
        if (newProduct) {
          if (kind !== "rachat") throw new UserError(at(i, "Une nouvelle marchandise s'achète, elle ne se vend pas."));
          // Named like a merchandise of an earlier line: say so, rather than « already exists ».
          if (tied.some((l) => l.productId != null && l.label === newProduct.name)) {
            throw new UserError(at(i, "Cette marchandise est déjà sur une autre ligne de l'achat."));
          }
          productId = await insertProduct(tx, member.shopId, newProduct);
          label = newProduct.name;
        } else if (productId != null) {
          const [product] = await tx
            .select({ name: schema.products.name })
            .from(schema.products)
            .where(
              and(eq(schema.products.id, productId), activeIn(member.shopId)),
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
            // A reminder for merchandise only: a purchase line without one has nothing to put in the chest.
            stockReminder: stockReminder && kind === "rachat" && productId != null,
            memberId: member.id,
          })
          .returning({ id: schema.transactions.id });
        if (productId != null) {
          // A sale goes through even without enough stock: only what is left
          // leaves it, so the stock stops at zero. The movement is written even
          // when nothing leaves, so that cancelling the line knows it.
          const delta = kind === "vente" ? -quantity : quantity;
          const reason = `${kind === "vente" ? "Vente" : "Achat"}${counterparty ? ` · ${counterparty}` : ""}`;
          // Throwing rolls back every line with its movement.
          const moved = await moveStock(tx, member.shopId, productId, delta, member.id, reason, line.id, {
            clamp: true,
          });
          if (!moved.ok) throw new UserError(at(i, moved.error));
        }
        written.push(line.id);
        tied.push({ productId, quantity, amount, label });
      }
      if (typedName && !known) {
        await createContactFromTransaction(tx, member.shopId, { name: typedName, notes, side: contactSide(kind), lines: tied });
      }
      return written;
    });
  } catch (error) {
    // A new merchandise named like one the shop already has, maybe archived.
    if (isUniqueViolation(error)) throw new UserError(DUPLICATE_MAYBE_ARCHIVED);
    throw error;
  }
}

/** Money in or out of the till alone, with no merchandise. Returns the new line's id. */
export async function recordCashLine(
  member: Actor,
  values: {
    kind: "entree" | "sortie";
    label: string;
    amount: number;
    counterparty: string | null;
    notes: string | null;
    /** The member has not yet put the septims in the till, or taken them out. */
    tillPending: boolean;
  },
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

/**
 * The merchandise of the purchase holding line `id` is in the chest: its
 * reminder goes. Gérants, or the member who wrote it.
 */
export async function markStockDeposited(member: Actor, id: number) {
  const t = schema.transactions;
  const [line] = await getDb()
    .select({ memberId: t.memberId })
    .from(t)
    .where(and(eq(t.id, id), eq(t.shopId, member.shopId), eq(t.stockReminder, true), isNull(t.cancelledAt)))
    .limit(1);
  if (!line) throw new UserError("Cet achat est déjà déposé, ou annulé.");
  if (!canActOn(member, line)) {
    throw new UserError("Seul un gérant peut le dire pour l'achat de quelqu'un d'autre.");
  }
  await clearStockReminder(member.shopId, id);
}

type Line = typeof schema.transactions.$inferSelect;

/**
 * Changes the septims of lines still counted of the entry holding line `id`:
 * `amounts` maps a line's id to its new septims. All of them or none, and the
 * stock does not move. Each changed line keeps who changed it. Gérants, or the
 * member who wrote it.
 */
export async function editAmounts(member: Actor, id: number, amounts: Map<number, number>) {
  const t = schema.transactions;
  await getDb().transaction(async (tx) => {
    const lines = await tx
      .select()
      .from(t)
      .where(and(eq(t.shopId, member.shopId), sameEntryAs(id), isNull(t.cancelledAt)))
      .orderBy(asc(t.id))
      .for("update");
    if (lines.length === 0) throw new UserError("Cette écriture est introuvable ou annulée.");
    // The lines of one entry share their author.
    if (!canActOn(member, lines[0])) {
      throw new UserError("Seul un gérant peut modifier l'écriture d'un autre membre.");
    }
    const byId = new Map(lines.map((line) => [line.id, line]));
    for (const lineId of amounts.keys()) {
      if (!byId.has(lineId)) throw new UserError("Une ligne a été annulée entre-temps : recharge la page.");
    }
    for (const [i, line] of lines.entries()) {
      const amount = amounts.get(line.id);
      if (amount === undefined || amount === line.amount) continue;
      const least = isCashKind(line.kind) ? 1 : 0;
      if (!Number.isInteger(amount) || amount < least) {
        throw new UserError(
          lineMessage(
            lines.length,
            i,
            least ? "Le montant doit être un nombre entier d'au moins 1 septim." : "Le montant doit être un nombre entier de septims.",
          ),
        );
      }
      await tx.update(t).set({ amount, editedAt: new Date(), editedBy: member.id }).where(eq(t.id, line.id));
    }
  });
}

/**
 * Cancels a line, or every line still counted of its entry (`whole`), and
 * puts the stock back: all of them or none. Gérants, or the member who wrote it.
 */
export async function cancelLines(member: Actor, id: number, whole = false) {
  await changeLines(member, id, whole, "cancel");
}

/**
 * Counts a cancelled line again, or every cancelled line of its entry
 * (`whole`), as if written anew: a sale takes its goods out of the stock
 * again, as far as it holds, a buyback puts them back in. Gérants, or the
 * member who wrote it.
 */
export async function restoreLines(member: Actor, id: number, whole = false) {
  await changeLines(member, id, whole, "restore");
}

async function changeLines(member: Actor, id: number, whole: boolean, change: "cancel" | "restore") {
  const t = schema.transactions;
  const cancel = change === "cancel";
  await getDb().transaction(async (tx) => {
    const lines = await tx
      .select()
      .from(t)
      .where(
        and(
          eq(t.shopId, member.shopId),
          whole ? sameEntryAs(id) : eq(t.id, id),
          cancel ? isNull(t.cancelledAt) : isNotNull(t.cancelledAt),
        ),
      )
      .orderBy(asc(t.id))
      .for("update");
    if (lines.length === 0) {
      throw new UserError(`Cette ligne est introuvable ou déjà ${cancel ? "annulée" : "rétablie"}.`);
    }
    // The lines of one entry share their author.
    if (!canActOn(member, lines[0])) {
      throw new UserError(`Seul un gérant peut ${cancel ? "annuler" : "rétablir"} la ligne d'un autre membre.`);
    }
    for (const line of lines) {
      if (cancel) await cancelOne(tx, member, line, lines.length > 1);
      else await restoreOne(tx, member, line);
    }
  });
}

async function cancelOne(tx: Tx, member: Actor, line: Line, several: boolean) {
  const t = schema.transactions;
  if (line.productId != null) {
    const m = schema.stockMovements;
    // What the line holds: a sale may have taken less than it sold.
    const [{ moved, moves }] = await tx
      .select({ moved: sql<number>`coalesce(sum(${m.delta}), 0)::int`, moves: sql<number>`count(*)::int` })
      .from(m)
      .where(and(eq(m.transactionId, line.id), eq(m.productId, line.productId)));
    const delta = cancelStockDelta(line.kind, line.quantity, moved, moves);
    const reason = `Annulation ${line.kind} n°${line.id}`;
    const result = await moveStock(tx, member.shopId, line.productId, delta, member.id, reason, line.id);
    // A cancelled buyback whose goods are already gone cannot be undone; throwing keeps every line.
    if (!result.ok) {
      throw new UserError(
        `Impossible d'annuler${several ? ` ${line.label}` : ""} : la marchandise rachetée a déjà été vendue.`,
      );
    }
  }
  await tx.update(t).set({ cancelledAt: new Date(), cancelledBy: member.id }).where(eq(t.id, line.id));
}

async function restoreOne(tx: Tx, member: Actor, line: Line) {
  const t = schema.transactions;
  if (line.productId != null) {
    // Like writing it again: a sale beyond the stock takes only what is left.
    const delta = line.kind === "vente" ? -line.quantity : line.quantity;
    const reason = `Rétablissement ${line.kind} n°${line.id}`;
    const result = await moveStock(tx, member.shopId, line.productId, delta, member.id, reason, line.id, {
      clamp: true,
    });
    if (!result.ok) throw new UserError(result.error);
  }
  await tx.update(t).set({ cancelledAt: null, cancelledBy: null }).where(eq(t.id, line.id));
}
