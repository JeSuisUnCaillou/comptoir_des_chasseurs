"use server";

import { redirect } from "next/navigation";
import { hashPassword, newPasswordError, normalizeUsername, usernameError } from "@/lib/auth/password";
import { requireAccount, startSession } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { text } from "@/lib/forms";
import { acceptInvitation, signUpWithInvitation } from "@/lib/invitations";
import { invitationPath, shopPath } from "@/lib/paths";

export type InvitationState = { error: string } | null;

/** The signed-in account takes the link: gérant of the shop, which it enters. */
export async function joinShop(_prev: InvitationState, formData: FormData): Promise<InvitationState> {
  const token = text(formData, "token", 100);
  const account = await requireAccount(invitationPath(token));
  const result = await attempt(() => acceptInvitation(token, account));
  if (!result.ok) return { error: result.message };
  redirect(shopPath(result.value.slug));
}

/** Someone with no account takes the link: their account is created, and they enter the shop. */
export async function signUp(_prev: InvitationState, formData: FormData): Promise<InvitationState> {
  const token = text(formData, "token", 100);
  const username = normalizeUsername(formData.get("username"));
  const name = text(formData, "name", 60);
  const password = String(formData.get("password") ?? "");
  if (!username || !name) return { error: "Identifiant et nom sont obligatoires." };
  const invalid = usernameError(username) ?? newPasswordError(password, formData.get("confirm"));
  if (invalid) return { error: invalid };
  const passwordHash = await hashPassword(password);
  const result = await attempt(() => signUpWithInvitation(token, { username, name, passwordHash }));
  if (!result.ok) return { error: result.message };
  await startSession(result.value.member);
  redirect(shopPath(result.value.shop.slug));
}
