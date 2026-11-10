"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { getDb, isUniqueViolation, schema } from "@/lib/db";
import { productCategory, type ProductCategory } from "@/lib/db/schema";
import { moveStock } from "@/lib/products";

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
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const category = String(formData.get("category")) as ProductCategory;
  const unit = String(formData.get("unit") ?? "").trim().slice(0, 30) || "pièce";
  const quantity = Number(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);

  if (!name) return { ok: false, message: "Le nom est obligatoire." };
  if (!productCategory.enumValues.includes(category)) return { ok: false, message: "Catégorie inconnue." };
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
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, message: "Une marchandise porte déjà ce nom (peut-être archivée, voir Gérer les tarifs)." };
    }
    throw error;
  }

  revalidatePath("/", "layout");
  return { ok: true, name };
}
