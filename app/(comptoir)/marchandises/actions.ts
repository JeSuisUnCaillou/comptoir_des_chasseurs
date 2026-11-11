"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { checked, optionalInt } from "@/lib/forms";
import { readProductIdentity, saveProduct as save, setBlacksmithLeatherPrice } from "@/lib/products";

export type ProductFormState = { error: string } | null;

/** A quantity a price is given for: 1 when left empty. */
function perQty(formData: FormData, key: string) {
  const n = optionalInt(formData, key);
  return n == null ? 1 : n;
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalInt(formData, "id");
  const { name, category, unit, error: identityError } = readProductIdentity(formData);

  const values = {
    name,
    category,
    unit,
    buyPrice: optionalInt(formData, "buyPrice"),
    buyQty: perQty(formData, "buyQty"),
    citizenBuyPrice: optionalInt(formData, "citizenBuyPrice"),
    sellPrice: optionalInt(formData, "sellPrice"),
    sellQty: perQty(formData, "sellQty"),
    bulkMin: optionalInt(formData, "bulkMin"),
    bulkPrice: optionalInt(formData, "bulkPrice"),
    bulkQty: perQty(formData, "bulkQty"),
    hidesPerBatch: category === "peau" ? optionalInt(formData, "hidesPerBatch") : null,
    leatherPerBatch: category === "peau" ? optionalInt(formData, "leatherPerBatch") : null,
    archived: checked(formData, "archived"),
  };

  if (Number.isNaN(id)) return { error: "Marchandise inconnue." };
  if (identityError) return { error: identityError };
  const numbers = Object.values(values).filter((v) => typeof v === "number") as number[];
  if (numbers.some((n) => Number.isNaN(n))) {
    return { error: "Les prix et quantités doivent être des nombres entiers positifs." };
  }
  if ([values.buyQty, values.sellQty, values.bulkQty].some((n) => n < 1)) {
    return { error: "Un prix se donne pour au moins 1 unité." };
  }
  if ((values.hidesPerBatch == null) !== (values.leatherPerBatch == null)) {
    return { error: "Indique les peaux ET les cuirs de la transformation, ou aucun des deux." };
  }

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
