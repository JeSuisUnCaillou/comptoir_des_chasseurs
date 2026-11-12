"use server";

import { redirect } from "next/navigation";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { attempt } from "@/lib/errors";
import { readProductIdentity, text } from "@/lib/forms";
import { createStocked, recordMovement as moveByHand, recordMovements } from "@/lib/products";
import { MAX_LINES, lineMessage } from "@/lib/transaction-kinds";

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

/**
 * Several merchandises in or out of stock at once, with one reason and no
 * septims: written all together or not at all.
 */
export async function recordStockMovement(_prev: MoveState, formData: FormData): Promise<MoveState> {
  const member = await requireMember();
  const direction = formData.get("direction");
  const reason = text(formData, "reason", 200);
  const productIds = formData.getAll("productId").map(String);
  const quantities = formData.getAll("quantity").map(Number);

  if (direction !== "in" && direction !== "out") {
    return { ok: false, message: "Indique si la marchandise entre ou sort du stock." };
  }
  const count = productIds.length;
  if (count === 0) return { ok: false, message: "Choisis au moins une marchandise." };
  if (count > MAX_LINES) return { ok: false, message: `Pas plus de ${MAX_LINES} marchandises à la fois.` };
  if (quantities.length !== count) return { ok: false, message: "Formulaire incomplet, recharge la page." };
  const at = (i: number, message: string) => lineMessage(count, i, message);

  const lines: { productId: number; quantity: number }[] = [];
  for (let i = 0; i < count; i++) {
    const productId = productIds[i] === "" ? NaN : Number(productIds[i]);
    const quantity = quantities[i];
    if (!Number.isInteger(productId)) return { ok: false, message: at(i, "Choisis la marchandise.") };
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, message: at(i, "La quantité doit être un nombre entier positif.") };
    }
    lines.push({ productId, quantity });
  }
  if (!reason) return { ok: false, message: "Indique le motif du mouvement." };

  const result = await attempt(() => recordMovements(member, direction, lines, reason));
  if (!result.ok) return result;
  revalidateShop();
  // Back to the Inventaire, whose history shows the new movements.
  redirect(shopPath(member.shop.slug, `/inventaire?inscrit=${result.value.join(",")}`));
}
