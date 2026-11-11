"use server";

import { MIN_PASSWORD_LENGTH, hashPassword, normalizeUsername, usernameError } from "@/lib/auth/password";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { readRole, text } from "@/lib/forms";
import { createAccount, resetAccountPassword, updateAccount } from "@/lib/members";

export type MemberFormState = { ok: boolean; message: string } | null;

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const me = await requireMember(["gerant"]);
  const username = normalizeUsername(formData.get("username"));
  const name = text(formData, "name", 60);
  const password = String(formData.get("password") ?? "");
  const role = readRole(formData);
  if (!username || !name || !role) return { ok: false, message: "Tous les champs sont obligatoires." };
  const invalid = usernameError(username);
  if (invalid) return { ok: false, message: invalid };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
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
  if (!Number.isInteger(id) || !name || !role) return;
  await updateAccount(me, id, name, role);
  revalidateShop();
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
