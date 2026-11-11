"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { moveStock } from "@/lib/products";
import { MAX_LINES } from "@/lib/transaction-kinds";

export type TransactionState = { ok: boolean; message: string } | null;

function revalidate() {
  for (const path of ["/", "/achat-vente", "/achat-vente/vente", "/achat-vente/achat", "/achat-vente/caisse", "/inventaire", "/tarifs"]) revalidatePath(path);
}


/**
 * Records a sale or a purchase of one or more merchandises: one register line
 * each, sharing the client and the notes, written all together or not at all.
 */
export async function recordTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const kind = formData.get("kind");
  const counterparty = String(formData.get("counterparty") ?? "").trim().slice(0, 100) || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  const productIds = formData.getAll("productId").map(String);
  const labels = formData.getAll("label").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const amounts = formData.getAll("amount").map(Number);

  if (kind !== "vente" && kind !== "rachat") return { ok: false, message: "Opération inconnue." };
  const count = productIds.length;
  if (count === 0) return { ok: false, message: "Indique l'article ou la marchandise." };
  if (count > MAX_LINES) return { ok: false, message: `Pas plus de ${MAX_LINES} marchandises à la fois.` };
  if (labels.length !== count || quantities.length !== count || amounts.length !== count) {
    return { ok: false, message: "Formulaire incomplet, recharge la page." };
  }
  // With several lines, each message says which one is wrong.
  const at = (i: number, message: string) => (count > 1 ? `Marchandise ${i + 1} : ${message}` : message);

  const lines: { productId: number | null; quantity: number; amount: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const raw = productIds[i];
    const productId = raw === "" || raw === "autre" ? null : Number(raw);
    const quantity = quantities[i];
    const amount = amounts[i];
    if (productId != null && !Number.isInteger(productId)) {
      return { ok: false, message: at(i, "Marchandise inconnue.") };
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, message: at(i, "La quantité doit être un nombre entier positif.") };
    }
    if (!Number.isInteger(amount) || amount < 0) {
      return { ok: false, message: at(i, "Le montant doit être un nombre entier de septims.") };
    }
    lines.push({ productId, quantity, amount, label: labels[i].trim().slice(0, 100) });
  }

  const db = getDb();
  let ids: number[];
  try {
    ids = await db.transaction(async (tx) => {
      const written: number[] = [];
      for (const [i, { productId, quantity, amount, label: typed }] of lines.entries()) {
        let label = typed;
        let delta = 0;
        let reason = "";
        if (productId != null) {
          const [product] = await tx
            .select({ name: schema.products.name })
            .from(schema.products)
            .where(and(eq(schema.products.id, productId), eq(schema.products.archived, false)))
            .limit(1);
          if (!product) throw new UserError(at(i, "Marchandise inconnue."));
          label = product.name;
          delta = kind === "vente" ? -quantity : quantity;
          reason = `${kind === "vente" ? "Vente" : "Achat"}${counterparty ? ` · ${counterparty}` : ""}`;
        }
        if (!label) throw new UserError(at(i, "Indique l'article ou la marchandise."));
        const [line] = await tx.insert(schema.transactions).values({
          kind,
          productId,
          label,
          quantity,
          amount,
          counterparty,
          notes,
          memberId: member.id,
        }).returning({ id: schema.transactions.id });
        if (productId != null) {
          // Throwing rolls back every line with its movement.
          const moved = await moveStock(tx, productId, delta, member.id, reason, line.id);
          if (!moved.ok) throw new UserError(at(i, "Stock insuffisant pour cette vente."));
        }
        written.push(line.id);
      }
      return written;
    });
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    throw error;
  }

  revalidate();
  // Back to the register, which shows the new lines.
  redirect(`/achat-vente?inscrit=${ids.join(",")}`);
}

class UserError extends Error {}

/** Money in or out of the till alone, with no merchandise: wages, the gérant's deposits... */
export async function recordCashMovement(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const kind = formData.get("kind");
  const amount = Number(formData.get("amount"));
  const label = String(formData.get("label") ?? "").trim().slice(0, 100);
  const counterparty = String(formData.get("counterparty") ?? "").trim().slice(0, 100) || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;

  if (kind !== "entree" && kind !== "sortie") {
    return { ok: false, message: "Indique si l'argent entre ou sort de la caisse." };
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, message: "Le montant doit être un nombre entier de septims, au moins 1." };
  }
  if (!label) return { ok: false, message: "Indique le motif du mouvement." };

  const [line] = await getDb()
    .insert(schema.transactions)
    .values({ kind, productId: null, label, quantity: 1, amount, counterparty, notes, memberId: member.id })
    .returning({ id: schema.transactions.id });
  revalidate();
  redirect(`/achat-vente?inscrit=${line.id}`);
}

/** Cancels a line and puts the stock back. Gérants, or the member who wrote it. */
export async function cancelTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Ligne inconnue." };
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const [line] = await tx
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.id, id), isNull(schema.transactions.cancelledAt)))
        .for("update")
        .limit(1);
      if (!line) throw new UserError("Cette ligne est introuvable ou déjà annulée.");
      if (member.role !== "gerant" && line.memberId !== member.id) {
        throw new UserError("Seul un gérant peut annuler la ligne d'un autre membre.");
      }
      if (line.productId != null) {
        const delta = line.kind === "vente" ? line.quantity : -line.quantity;
        const moved = await moveStock(tx, line.productId, delta, member.id, `Annulation ${line.kind} n°${line.id}`, line.id);
        // A cancelled buyback whose goods are already gone cannot be undone.
        if (!moved.ok) throw new UserError("Impossible d'annuler : la marchandise rachetée a déjà été vendue.");
      }
      await tx
        .update(schema.transactions)
        .set({ cancelledAt: new Date(), cancelledBy: member.id })
        .where(eq(schema.transactions.id, id));
    });
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    throw error;
  }
  revalidate();
  return { ok: true, message: "Ligne annulée, stock rétabli." };
}
