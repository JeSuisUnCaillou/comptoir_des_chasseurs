"use server";

import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { readProductIdentity, text } from "@/lib/forms";
import { createStocked, recordMovement as moveByHand } from "@/lib/products";

export type MoveState = { ok: boolean; message: string } | null;

export async function recordMovement(_prev: MoveState, formData: FormData): Promise<MoveState> {
  const member = await requireMember();
  const productId = Number(formData.get("productId"));
  const direction = formData.get("direction");
  const quantity = Number(formData.get("quantity"));
  const reason = text(formData, "reason", 200);

  if (!Number.isInteger(productId) || (direction !== "in" && direction !== "out")) {
    return { ok: false, message: "Mouvement invalide." };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: "La quantité doit être un nombre entier positif." };
  }
  if (!reason) return { ok: false, message: "Indique le motif du mouvement." };

  const result = await moveByHand(member, productId, direction === "in" ? quantity : -quantity, reason);
  if (!result.ok) return { ok: false, message: result.error };

  revalidateShop();
  return { ok: true, message: `Stock mis à jour : ${result.stock}.` };
}

export type CreateState = { ok: true; name: string } | { ok: false; message: string } | null;

/**
 * Creates a merchandise that does not exist yet, without prices, and records
 * its first entry in stock. Prices are set later in Gérer les tarifs.
 */
export async function createAndStock(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const member = await requireMember();
  const { error, ...identity } = readProductIdentity(formData);
  const quantity = Number(formData.get("quantity"));
  const reason = text(formData, "reason", 200);

  if (error) return { ok: false, message: error };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, message: "La quantité doit être un nombre entier positif." };
  }
  if (!reason) return { ok: false, message: "Indique le motif du mouvement." };

  const result = await attempt(() => createStocked(member, identity, quantity, reason));
  if (!result.ok) return result;

  revalidateShop();
  return { ok: true, name: identity.name };
}
