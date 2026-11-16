"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { text } from "@/lib/forms";
import { shopPath } from "@/lib/paths";
import { removeShopLogo, saveShopLogo } from "@/lib/shop-logos";
import { deleteShop, updateShop } from "@/lib/shops";
import { revalidateShop } from "../revalidate";

export type ShopSettingsState = { ok: boolean; message: string } | null;

/** A gérant renames the shop, and may move it to another address. */
export async function saveShop(_prev: ShopSettingsState, formData: FormData): Promise<ShopSettingsState> {
  const me = await requireMember(["gerant"]);
  const name = text(formData, "name", 60);
  const address = text(formData, "slug", 60) || me.shop.slug;
  if (!name) return { ok: false, message: "Le nom de la boutique est obligatoire." };
  const result = await attempt(() => updateShop(me.shop, name, address));
  if (!result.ok) return result;
  revalidateShop();
  if (result.value.slug !== me.shop.slug) redirect(shopPath(result.value.slug, "/reglages"));
  return { ok: true, message: "Boutique enregistrée." };
}

/** A gérant deletes the shop and all it holds, once its name is typed again. */
export async function removeShop(_prev: ShopSettingsState, formData: FormData): Promise<ShopSettingsState> {
  const me = await requireMember(["gerant"]);
  const result = await attempt(() => deleteShop(me, me.shop, text(formData, "confirm", 60)));
  if (!result.ok) return result;
  redirect("/boutiques");
}

/** A gérant uploads the shop's logo, already shrunk to a small PNG by the page. */
export async function saveLogo(_prev: ShopSettingsState, formData: FormData): Promise<ShopSettingsState> {
  const me = await requireMember(["gerant"]);
  const file = formData.get("logo");
  const bytes = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
  const result = await attempt(() => saveShopLogo(me.shopId, bytes));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "Logo enregistré." };
}

/** A gérant removes the shop's logo: the app's comes back. */
export async function removeLogo(_prev: ShopSettingsState): Promise<ShopSettingsState> {
  const me = await requireMember(["gerant"]);
  await removeShopLogo(me.shopId);
  revalidateShop();
  return { ok: true, message: "Logo retiré." };
}
