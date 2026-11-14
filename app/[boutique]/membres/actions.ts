"use server";

import { MIN_PASSWORD_LENGTH, hashPassword, newPasswordError, normalizeUsername, usernameError } from "@/lib/auth/password";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { createEmployeeInvitation } from "@/lib/invitations";
import { invitationPath } from "@/lib/paths";
import { optionalText, readRole, text } from "@/lib/forms";
import { createAccount, resetAccountPassword, setAccountActive, updateAccount } from "@/lib/members";

export type MemberFormState = { ok: boolean; message: string } | null;

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const me = await requireMember(["gerant"]);
  const username = normalizeUsername(formData.get("username"));
  const name = text(formData, "name", 60);
  const password = String(formData.get("password") ?? "");
  const role = readRole(formData);
  if (!username || !name || !role) return { ok: false, message: "Tous les champs sont obligatoires." };
  const invalid = usernameError(username) ?? newPasswordError(password);
  if (invalid) return { ok: false, message: invalid };
  const passwordHash = await hashPassword(password);
  const result = await attempt(() => createAccount(me.shopId, { username, name, role, passwordHash }));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: `Compte « ${username} » créé. Donne-lui son mot de passe.` };
}

export async function updateMember(formData: FormData) {
  const me = await requireMember(["gerant"]);
  const id = Number(formData.get("id"));
  const name = text(formData, "name", 60);
  const role = readRole(formData);
  if (!Number.isInteger(id) || !name) return;
  await updateAccount(me, id, name, role);
  revalidateShop();
}

/** A gérant deactivates an account of their shop, or reactivates it as an employé. */
export async function setMemberActive(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const me = await requireMember(["gerant"]);
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Membre inconnu." };
  const result = await attempt(() => setAccountActive(me, id, formData.get("active") === "true"));
  if (!result.ok) return result;
  revalidateShop();
  return null;
}

export async function resetPassword(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const me = await requireMember(["gerant"]);
  const id = Number(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (!Number.isInteger(id)) return { ok: false, message: "Membre inconnu." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `${MIN_PASSWORD_LENGTH} caractères minimum.` };
  }
  const passwordHash = await hashPassword(password);
  const result = await attempt(() => resetAccountPassword(me, id, passwordHash));
  if (!result.ok) return result;
  return { ok: true, message: "Mot de passe changé." };
}

/** A gérant creates a link that makes whoever opens it an employé of the shop, named beforehand or not. */
export async function inviteEmployee(_prev: unknown, formData: FormData): Promise<{ link: string; name: string | null }> {
  const me = await requireMember(["gerant"]);
  const name = optionalText(formData, "name", 60);
  const token = await createEmployeeInvitation(me, name);
  revalidateShop();
  return { link: invitationPath(token), name };
}
