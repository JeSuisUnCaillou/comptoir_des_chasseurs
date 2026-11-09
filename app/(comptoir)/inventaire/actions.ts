"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
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
