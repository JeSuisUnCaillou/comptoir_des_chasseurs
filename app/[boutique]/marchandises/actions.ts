"use server";

import { redirect } from "next/navigation";
import { shopPath } from "@/lib/paths";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { checked, optionalInt, readProductIdentity, readProductPrices } from "@/lib/forms";
import { saveProduct as save, moveFeatured, setBlacksmithLeatherPrice, setFeatured } from "@/lib/products";

export type ProductFormState = { error: string } | null;

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "id");
  const { name, category, unit, error: identityError } = readProductIdentity(formData);

  const { prices, error: priceError } = readProductPrices(formData, category);
  const values = { name, category, unit, ...prices, archived: checked(formData, "archived") };

  if (Number.isNaN(id)) return { error: "Marchandise inconnue." };
  if (identityError) return { error: identityError };
  if (priceError) return { error: priceError };

  const result = await attempt(() => save(member.shopId, id, values));
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

/** A gérant moves a featured product one place earlier or later on the Tarifs. */
export async function saveFeaturedOrder(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "productId");
  const step = formData.get("step") === "up" ? -1 : 1;
  if (id == null || Number.isNaN(id)) return;
  const result = await attempt(() => moveFeatured(member.shopId, id, step));
  if (result.ok) revalidateShop();
}
