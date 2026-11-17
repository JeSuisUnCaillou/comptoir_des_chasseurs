"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { shopPath } from "@/lib/paths";
import { endShopSetup, recordOpeningTill } from "@/lib/shop-setup";
import { revalidateShop } from "./revalidate";

export type ShopSetupState = { ok: boolean; message: string } | null;

/** Step 1 of setting up a new shop: a gérant writes what its till holds. */
export async function setOpeningTill(_prev: ShopSetupState, formData: FormData): Promise<ShopSetupState> {
  const member = await requireMember(["gerant"]);
  const amount = Number(formData.get("amount"));
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, message: "Le montant doit être un nombre entier d'au moins 1 septim." };
  }
  const result = await attempt(() => recordOpeningTill(member, amount));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "La caisse de départ est inscrite au registre." };
}

/** A gérant skips setting up the shop: the Grand livre no longer offers it. */
export async function skipShopSetup() {
  const member = await requireMember(["gerant"]);
  await endShopSetup(member.shopId);
  revalidateShop();
  redirect(shopPath(member.shop.slug));
}
