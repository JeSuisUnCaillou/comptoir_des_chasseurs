"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { getDb, isUniqueViolation, schema } from "@/lib/db";
import { DUPLICATE_PRODUCT_NAME, moveStock, readProductIdentity } from "@/lib/products";

export type MoveState = { ok: boolean; message: string } | null;

export async function recordMovement(_prev: MoveState, formData: FormData): Promise<MoveState> {
  const member = await requireMember();
  const productId = Number(formData.get("productId"));
  const direction = formData.get("direction");
  const quantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);

  if (!Number.isInteger(productId) || (direction !== "in" && direction !== "out")) {
    return { ok: false, message: "Mouvement invalide." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: "La quantité doit être un nombre entier positif." };
  }
  if (!reason) return { ok: false, message: "Indique le motif du mouvement." };

  const delta = direction === "in" ? quantity : -quantity;
  const result = await getDb().transaction((tx) => moveStock(tx, productId, delta, member.id, reason));
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/inventaire");
  revalidatePath("/tarifs");
  return { ok: true, message: `Stock mis à jour : ${result.stock}.` };
}

export type CreateState = { ok: true; name: string } | { ok: false; message: string } | null;

/**
 * Creates a merchandise that does not exist yet, without prices, and records
 * its first entry in stock. Prices are set later in Gérer les tarifs.
 */
export async function createAndStock(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const member = await requireMember();
  const { name, category, unit, error } = readProductIdentity(formData);
  const quantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);

  if (error) return { ok: false, message: error };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: "La quantité doit être un nombre entier positif." };
  }
  if (!reason) return { ok: false, message: "Indique le motif du mouvement." };

  try {
    await getDb().transaction(async (tx) => {
      const [product] = await tx
        .insert(schema.products)
        .values({ name, category, unit })
        .returning({ id: schema.products.id });
      const result = await moveStock(tx, product.id, quantity, member.id, reason);
      if (!result.ok) throw new Error(result.error);
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false, message: `${DUPLICATE_PRODUCT_NAME} Elle est peut-être archivée : voir Gérer les tarifs.` };
    }
    throw e;
  }

  revalidatePath("/", "layout");
  return { ok: true, name };
}
