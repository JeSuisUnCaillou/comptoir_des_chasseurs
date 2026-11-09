"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { moveStock } from "@/lib/products";

export type TransactionState = { ok: boolean; message: string; id?: number } | null;

function revalidate() {
  for (const path of ["/", "/registre", "/inventaire", "/tarifs"]) revalidatePath(path);
}

export async function recordTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const kind = formData.get("kind");
  const productRaw = String(formData.get("productId") ?? "");
  const productId = productRaw === "" || productRaw === "autre" ? null : Number(productRaw);
  const quantity = Number(formData.get("quantity"));
  const amount = Number(formData.get("amount"));
  const counterparty = String(formData.get("counterparty") ?? "").trim().slice(0, 100) || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  let label = String(formData.get("label") ?? "").trim().slice(0, 100);

  if (kind !== "vente" && kind !== "rachat") return { ok: false, message: "Opération inconnue." };
  if (productId != null && !Number.isInteger(productId)) {
    return { ok: false, message: "Marchandise inconnue." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: "La quantité doit être un nombre entier positif." };
  }
  if (!Number.isInteger(amount) || amount < 0) {
    return { ok: false, message: "Le montant doit être un nombre entier de septims." };
  }

  const db = getDb();
  let id: number;
  try {
    id = await db.transaction(async (tx) => {
      if (productId != null) {
        const [product] = await tx
          .select({ name: schema.products.name })
          .from(schema.products)
          .where(and(eq(schema.products.id, productId), eq(schema.products.archived, false)))
          .limit(1);
        if (!product) throw new UserError("Marchandise inconnue.");
        label = product.name;
        const delta = kind === "vente" ? -quantity : quantity;
        const reason = `${kind === "vente" ? "Vente" : "Rachat"}${counterparty ? ` · ${counterparty}` : ""}`;
        const moved = await moveStock(tx, productId, delta, member.id, reason);
        if (!moved.ok) throw new UserError("Stock insuffisant pour cette vente.");
      }
      if (!label) throw new UserError("Indique l'article ou la marchandise.");
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
      return line.id;
    });
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    throw error;
  }

  revalidate();
  return {
    ok: true,
    id,
    message: `${kind === "vente" ? "Vente" : "Rachat"} inscrit : ${quantity} × ${label}, ${amount} septim${amount > 1 ? "s" : ""}.`,
  };
}

class UserError extends Error {}

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
        const moved = await moveStock(tx, line.productId, delta, member.id, `Annulation ${line.kind} n°${line.id}`);
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
