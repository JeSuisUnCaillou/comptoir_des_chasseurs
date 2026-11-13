"use server";

import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireMember, startSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPassword, setOwnPassword, unlinkDiscord } from "@/lib/members";
import { revalidateShop } from "../revalidate";
import { shopPath } from "@/lib/paths";

export type PasswordState = { ok: boolean; message: string } | null;

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const member = await requireMember();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  const first = !hasPassword(member);
  if (!first && !(await verifyPassword(current, member.passwordHash))) {
    return { ok: false, message: "Le mot de passe actuel est incorrect." };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  if (next !== formData.get("confirm")) {
    return { ok: false, message: "Les deux mots de passe ne correspondent pas." };
  }
  const passwordHash = await hashPassword(next);
  await setOwnPassword(member.id, passwordHash);
  // Other devices are signed out; this one gets a fresh session.
  await startSession({ ...member, passwordHash });
  if (first) revalidateShop();
  return { ok: true, message: first ? "Mot de passe choisi." : "Mot de passe changé." };
}

/** The member unlinks Discord from their account: only their password opens it again. */
export async function unlinkMyDiscord() {
  const member = await requireMember();
  // Without a password, nothing would open the account any more.
  if (!hasPassword(member)) redirect(shopPath(member.shop.slug, "/mot-de-passe?discord=sans-mot-de-passe"));
  // Sessions opened with Discord on other devices close.
  await startSession(await unlinkDiscord(member.id));
  redirect(shopPath(member.shop.slug, "/mot-de-passe?discord=delie"));
}
