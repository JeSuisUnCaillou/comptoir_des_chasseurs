"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { text } from "@/lib/forms";
import { createShopInvitation } from "@/lib/invitations";
import { invitationPath, shopPath } from "@/lib/paths";
import { createShop } from "@/lib/shops";

export type ShopFormState = { ok: boolean; message: string; link?: string } | null;

/** The super admin opens a shop, and enters it as its gérant. */
export async function openShop(_prev: ShopFormState, formData: FormData): Promise<ShopFormState> {
  const account = await requireAccount("/boutiques");
  const name = text(formData, "name", 60);
  if (!name) return { ok: false, message: "Le nom de la boutique est obligatoire." };
  const result = await attempt(() => createShop(account, name));
  if (!result.ok) return result;
  redirect(shopPath(result.value.slug));
}

/** The super admin opens a shop for someone else, and gets the link that makes them its gérant. */
export async function inviteGerant(_prev: ShopFormState, formData: FormData): Promise<ShopFormState> {
  const account = await requireAccount("/boutiques");
  const name = text(formData, "name", 60);
  if (!name) return { ok: false, message: "Le nom de la boutique est obligatoire." };
  const result = await attempt(() => createShopInvitation(account, name));
  if (!result.ok) return result;
  revalidatePath("/boutiques");
  return {
    ok: true,
    message: `Boutique « ${result.value.shop.name} » ouverte. Donne ce lien à son futur gérant : il ne sert qu'une fois.`,
    link: invitationPath(result.value.token),
  };
}
