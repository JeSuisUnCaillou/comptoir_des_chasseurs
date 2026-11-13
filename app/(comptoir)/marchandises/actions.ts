"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { checked, optionalInt, readProductIdentity, readProductPrices } from "@/lib/forms";
import { saveProduct as save, setBlacksmithLeatherPrice, setFeaturedProduct } from "@/lib/products";

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
  revalidatePath("/", "layout");
  redirect(formData.get("depuis") === "tarifs" ? "/tarifs" : "/marchandises");
}

export async function saveBlacksmithPrice(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const value = Number(formData.get("value"));
  if (!Number.isInteger(value) || value < 0) return;
  await setBlacksmithLeatherPrice(member.shopId, value);
  revalidatePath("/", "layout");
}

/** A gérant's choice of the product the Tarifs page puts forward, among the shop's active ones. */
export async function saveFeaturedProduct(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "productId");
  if (id == null || Number.isNaN(id)) return;
  const result = await attempt(() => setFeaturedProduct(member.shopId, id));
  if (result.ok) revalidatePath("/", "layout");
}
