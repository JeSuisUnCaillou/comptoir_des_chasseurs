"use server";

import { redirect } from "next/navigation";
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  normalizeUsername,
  verifyPassword,
} from "@/lib/auth/password";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/return-path";
import { endSession, startSession } from "@/lib/auth/session";
import { text } from "@/lib/forms";
import { accountByUsername, createFirstGerant as createFirst, hasActiveShop } from "@/lib/members";
import { currentShop } from "@/lib/shops";

export type AuthState = { error: string } | null;

// Compared against when the username is unknown, so both cases take as long.
const DUMMY_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const member = await accountByUsername(username);
  const valid = await verifyPassword(password, member?.passwordHash ?? DUMMY_HASH);
  if (!member || !valid || !(member.superAdmin || (await hasActiveShop(member.id)))) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }
  await startSession(member);
  redirect(safeReturnPath(formData.get(RETURN_PARAM)));
}

/** Creates the first gérant. Only works while there is no member at all. */
export async function createFirstGerant(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const name = text(formData, "name", 60);
  const password = String(formData.get("password") ?? "");
  if (!username || !name) return { error: "Identifiant et nom sont obligatoires." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  if (password !== formData.get("confirm")) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }
  const passwordHash = await hashPassword(password);

  const created = await createFirst((await currentShop()).id, { username, name, passwordHash });
  if (!created) return { error: "Le comptoir a déjà un gérant. Connecte-toi." };
  await startSession(created);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/connexion");
}
