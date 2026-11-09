"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { moveStock } from "@/lib/products";

export type TransactionState = { ok: boolean; message: string } | null;

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
  try {
    await db.transaction(async (tx) => {
      if (productId != null) {
        const [product] = await tx
          .select({ name: schema.products.name })
          .from(schema.products)
          .where(eq(schema.products.id, productId))
          .limit(1);
        if (!product) throw new UserError("Marchandise inconnue.");
        label = product.name;
        const delta = kind === "vente" ? -quantity : quantity;
        const reason = `${kind === "vente" ? "Vente" : "Rachat"}${counterparty ? ` · ${counterparty}` : ""}`;
        const moved = await moveStock(tx, productId, delta, member.id, reason);
        if (!moved.ok) throw new UserError("Stock insuffisant pour cette vente.");
      }
      if (!label) throw new UserError("Indique l'article ou la marchandise.");
      await tx.insert(schema.transactions).values({
        kind,
        productId,
        label,
        quantity,
        amount,
        counterparty,
        notes,
        memberId: member.id,
      });
    });
  } catch (error) {
    if (error instanceof UserError) return { ok: false, message: error.message };
    throw error;
  }

  revalidate();
  return {
    ok: true,
    message: `${kind === "vente" ? "Vente" : "Rachat"} inscrit : ${quantity} × ${label}, ${amount} septim${amount > 1 ? "s" : ""}.`,
  };
}

class UserError extends Error {}

/** Cancels a line and puts the stock back. Gérants, or the member who wrote it. */
export async function cancelTransaction(formData: FormData) {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    const [line] = await tx
      .update(schema.transactions)
      .set({ cancelledAt: new Date(), cancelledBy: member.id })
      .where(and(eq(schema.transactions.id, id), isNull(schema.transactions.cancelledAt)))
      .returning();
    if (!line) return;
    if (member.role !== "gerant" && line.memberId !== member.id) {
      tx.rollback();
    }
    if (line.productId != null) {
      const delta = line.kind === "vente" ? line.quantity : -line.quantity;
      const moved = await moveStock(tx, line.productId, delta, member.id, `Annulation ${line.kind} n°${line.id}`);
      // A cancelled buyback whose goods are already gone cannot be undone.
      if (!moved.ok) tx.rollback();
    }
  }).catch((error) => {
    if ((error as Error)?.name !== "TransactionRollbackError") throw error;
  });
  revalidate();
}
