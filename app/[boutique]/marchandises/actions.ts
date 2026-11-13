"use server";

import { redirect } from "next/navigation";
import { shopPath } from "@/lib/paths";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { GROUP_NAME_MAX, checked, optionalId, optionalInt, readProductIdentity, readProductPrices, text } from "@/lib/forms";
import { createPrivilegedGroup, deletePrivilegedGroup, renamePrivilegedGroup } from "@/lib/privileged-groups";
import { addCategory, deleteCategory, renameCategory } from "@/lib/categories";
import {
  saveProduct as save,
  setBlacksmithLeatherPrice,
  setFeatured,
  setFeaturedOrder,
} from "@/lib/products";

export type ProductFormState = { error: string } | null;

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "id");
  const { name, categoryId, unit, error: identityError } = readProductIdentity(formData);

  const { prices, privileged, error: priceError } = readProductPrices(formData);
  const values = { name, categoryId, unit, ...prices, archived: checked(formData, "archived") };

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

/** A gérant puts a product forward on top of the Tarifs, after the others already there, or takes it back. */
export async function saveFeatured(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "productId");
  if (id == null || Number.isNaN(id)) return;
  const result = await attempt(() => setFeatured(member.shopId, id, formData.get("featured") === "1"));
  if (result.ok) revalidateShop();
}

/** A gérant puts the featured products in a new order, the whole list at once (dragged in the page). */
export async function saveFeaturedOrder(ids: number[]): Promise<boolean> {
  const member = await requireMember(["gerant"]);
  if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) return false;
  const result = await attempt(() => setFeaturedOrder(member.shopId, ids));
  if (result.ok) revalidateShop();
  return result.ok;
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

export type CategoryFormState = { error: string } | { ok: string } | null;

/**
 * A gérant adds a category (no `id`), renames one, or deletes one
 * (`intent` = "supprimer"), on Gérer les marchandises.
 */
export async function saveCategory(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  const name = text(formData, "name", 60);
  if (Number.isNaN(id)) return { error: "Catégorie inconnue." };
  const deleting = formData.get("intent") === "supprimer";
  if (!deleting && !name) return { error: "Le nom de la catégorie est obligatoire." };

  const result = await attempt(() =>
    id == null
      ? addCategory(member.shopId, name)
      : deleting
        ? deleteCategory(member.shopId, id)
        : renameCategory(member.shopId, id, name),
  );
  if (!result.ok) return { error: result.message };
  revalidateShop();
  return { ok: id == null ? `Catégorie « ${name} » ajoutée.` : deleting ? "Catégorie supprimée." : "Catégorie renommée." };
}
