"use server";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireMember, startSession } from "@/lib/auth/session";

export type PasswordState = { ok: boolean; message: string } | null;

export async function changePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const member = await requireMember();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  if (!(await verifyPassword(current, member.passwordHash))) {
    return { ok: false, message: "Le mot de passe actuel est incorrect." };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Le nouveau mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  if (next !== formData.get("confirm")) {
    return { ok: false, message: "Les deux mots de passe ne correspondent pas." };
  }
  const passwordHash = await hashPassword(next);
  await getDb().update(schema.members).set({ passwordHash }).where(eq(schema.members.id, member.id));
  // Other devices are signed out; this one gets a fresh session.
  await startSession({ id: member.id, passwordHash });
  return { ok: true, message: "Mot de passe changé." };
}
