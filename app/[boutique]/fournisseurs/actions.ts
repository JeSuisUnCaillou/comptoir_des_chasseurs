"use server";

import { redirect } from "next/navigation";
import { shopPath } from "@/lib/paths";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { optionalId, text } from "@/lib/forms";
import { deleteSupplier as remove, removeOffer as unoffer, saveOffer as offer, saveSupplier as save } from "@/lib/suppliers";

// `at` changes on every success, so a form can clear itself by key.
export type SupplierFormState = { ok: boolean; message: string; at?: number } | null;

/** Creates a contact, or updates it when the form carries its id. */
export async function saveSupplier(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  const member = await requireMember(["gerant"]);
  const supplierId = optionalId(formData);
  const values = {
    name: text(formData, "name", 100),
    place: text(formData, "place", 100),
    notes: text(formData, "notes", 300),
  };
  if (Number.isNaN(supplierId)) return { ok: false, message: "Contact inconnu." };
  if (!values.name) return { ok: false, message: "Le nom est obligatoire." };

  const result = await attempt(() => save(member.shopId, supplierId, values));
  if (!result.ok) return result;
  revalidateShop();
  // A new contact goes straight to its page, to add what it sells or buys.
  if (supplierId == null) redirect(shopPath(member.shop.slug, `/fournisseurs/${result.value}`));
  return { ok: true, message: "Contact enregistré." };
}

/** Adds a merchandise to a contact, or changes its price and side if already listed. */
export async function saveOffer(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  const member = await requireMember(["gerant"]);
  const supplierId = optionalId(formData, "supplierId");
  const productId = optionalId(formData, "productId");
  const price = Number(formData.get("price"));
  const qty = Number(formData.get("qty") || 1);
  const side = formData.get("side");
  if (!supplierId || !productId) return { ok: false, message: "Choisis une marchandise." };
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
    return { ok: false, message: "Le prix doit être un nombre entier (0 ou plus)." };
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) {
    return { ok: false, message: "La quantité doit être un nombre entier d'au moins 1." };
  }
  if (side !== "sells" && side !== "buys") return { ok: false, message: "Dis s'il nous la vend ou nous l'achète." };
  const result = await attempt(() => offer(member.shopId, { supplierId, productId, price, qty, side }));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "Marchandise enregistrée.", at: Date.now() };
}

export async function removeOffer(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const offerId = optionalId(formData);
  const supplierId = optionalId(formData, "supplierId");
  if (!offerId || !supplierId) return;
  await unoffer(member.shopId, supplierId, offerId);
  revalidateShop();
}

export async function deleteSupplier(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const supplierId = optionalId(formData);
  if (supplierId) await remove(member.shopId, supplierId);
  revalidateShop();
  redirect(shopPath(member.shop.slug, "/fournisseurs"));
}
