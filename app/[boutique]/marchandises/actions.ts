"use server";

import { redirect } from "next/navigation";
import { shopPath } from "@/lib/paths";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { GROUP_NAME_MAX, checked, optionalId, optionalInt, readProductIdentity, readProductPrices, text } from "@/lib/forms";
import {
  createPrivilegedGroup,
  deletePrivilegedGroup,
  renamePrivilegedGroup,
  saveProduct as save,
  setBlacksmithLeatherPrice,
  setFeaturedProduct,
} from "@/lib/products";

export type ProductFormState = { error: string } | null;

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "id");
  const { name, category, unit, error: identityError } = readProductIdentity(formData);

  const { prices, privileged, error: priceError } = readProductPrices(formData, category);
  const values = { name, category, unit, ...prices, archived: checked(formData, "archived") };

  if (Number.isNaN(id)) return { error: "Marchandise inconnue." };
  if (identityError) return { error: identityError };
  if (priceError) return { error: priceError };

  const result = await attempt(() => save(member.shopId, id, values, privileged));
  if (!result.ok) return { error: result.message };
  revalidateShop();
  redirect(shopPath(member.shop.slug, formData.get("depuis") === "tarifs" ? "/tarifs" : "/marchandises"));
}

export async function saveBlacksmithPrice(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const value = Number(formData.get("value"));
  if (!Number.isInteger(value) || value < 0) return;
  await setBlacksmithLeatherPrice(member.shopId, value);
  revalidateShop();
}

/** A gérant's choice of the product the Tarifs page puts forward, among the shop's active ones. */
export async function saveFeaturedProduct(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "productId");
  if (id == null || Number.isNaN(id)) return;
  const result = await attempt(() => setFeaturedProduct(member.shopId, id));
  if (result.ok) revalidateShop();
}

export type GroupState = { ok: boolean; message: string } | null;

/** A gérant adds a privileged group to the shop, a group of sellers with their own buyback prices. */
export async function addPrivilegedGroup(_prev: GroupState, formData: FormData): Promise<GroupState> {
  const member = await requireMember(["gerant"]);
  const name = text(formData, "name", GROUP_NAME_MAX);
  if (!name) return { ok: false, message: "Donne un nom au groupe." };
  const result = await attempt(() => createPrivilegedGroup(member.shopId, name));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: `Groupe « ${name} » ajouté. Ses prix se fixent sur chaque marchandise.` };
}

/** A gérant renames a privileged group, or removes it with its prices. */
export async function savePrivilegedGroup(_prev: GroupState, formData: FormData): Promise<GroupState> {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  if (id == null || Number.isNaN(id)) return { ok: false, message: "Groupe inconnu." };
  if (formData.get("intent") === "delete") {
    const result = await attempt(() => deletePrivilegedGroup(member.shopId, id));
    if (!result.ok) return result;
    revalidateShop();
    return { ok: true, message: "Groupe supprimé." };
  }
  const name = text(formData, "name", GROUP_NAME_MAX);
  if (!name) return { ok: false, message: "Donne un nom au groupe." };
  const result = await attempt(() => renamePrivilegedGroup(member.shopId, id, name));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "Groupe renommé." };
}
