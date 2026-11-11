"use server";

import { revalidatePath } from "next/cache";
import { memberRole, type MemberRole } from "@/lib/db/schema";
import { MIN_PASSWORD_LENGTH, hashPassword, normalizeUsername } from "@/lib/auth/password";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { text } from "@/lib/forms";
import { createAccount, resetAccountPassword, updateAccount } from "@/lib/members";

export type MemberFormState = { ok: boolean; message: string } | null;

function readRole(formData: FormData): MemberRole | null {
  const role = String(formData.get("role")) as MemberRole;
  return memberRole.enumValues.includes(role) ? role : null;
}

export async function createMember(_prev: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const me = await requireMember(["gerant"]);
  const username = normalizeUsername(formData.get("username"));
  const name = text(formData, "name", 60);
  const password = String(formData.get("password") ?? "");
  const role = readRole(formData);
  if (!username || !name || !role) return { ok: false, message: "Tous les champs sont obligatoires." };
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return { ok: false, message: "L'identifiant ne peut contenir que des lettres, chiffres, points et tirets." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  const passwordHash = await hashPassword(password);
  const result = await attempt(() => createAccount(me.shopId, { username, name, role, passwordHash }));
  if (!result.ok) return result;
  revalidatePath("/membres");
  return { ok: true, message: `Compte « ${username} » créé. Donne-lui son mot de passe.` };
}

export async function updateMember(formData: FormData) {
  const me = await requireMember(["gerant"]);
  const id = Number(formData.get("id"));
  const name = text(formData, "name", 60);
  const role = readRole(formData);
  if (!Number.isInteger(id) || !name || !role) return;
  await updateAccount(me, id, name, role);
  revalidatePath("/", "layout");
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
