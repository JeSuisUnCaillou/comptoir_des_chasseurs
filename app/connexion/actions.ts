"use server";

import { redirect } from "next/navigation";
import {
  hashPassword,
  newPasswordError,
  normalizeUsername,
  verifyPassword,
} from "@/lib/auth/password";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/return-path";
import { forgetPendingDiscord, linkPendingDiscord } from "@/lib/auth/discord";
import { endSession, startSession } from "@/lib/auth/session";
import { text } from "@/lib/forms";
import { accountByUsername, canSignIn, createFirstGerant as createFirst } from "@/lib/members";
import { firstShop } from "@/lib/shops";

export type AuthState = { error: string } | null;

// Compared against when the username is unknown, so both cases take as long.
const DUMMY_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const member = await accountByUsername(username);
  const valid = await verifyPassword(password, member?.passwordHash ?? DUMMY_HASH);
  if (!member || !valid || !(await canSignIn(member))) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }
  await startSession(await linkPendingDiscord(member));
  redirect(safeReturnPath(formData.get(RETURN_PARAM)));
}

/** Forgets the Discord account waiting to be linked: it wasn't theirs. */
export async function cancelPendingDiscord() {
  await forgetPendingDiscord();
  redirect("/connexion");
}

/** Creates the first gérant. Only works while there is no member at all. */
export async function createFirstGerant(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const name = text(formData, "name", 60);
  const password = String(formData.get("password") ?? "");
  if (!username || !name) return { error: "Identifiant et nom sont obligatoires." };
  const invalid = newPasswordError(password, formData.get("confirm"));
  if (invalid) return { error: invalid };
  const passwordHash = await hashPassword(password);

  const created = await createFirst((await firstShop()).id, { username, name, passwordHash });
  if (!created) return { error: "Le premier gérant existe déjà. Connecte-toi." };
  await startSession(created);
  redirect("/");
}

/** Signs out, to the login page or, when the form names one, back to a page (an invitation). */
export async function logout(formData?: FormData) {
  await endSession();
  const back = formData?.get(RETURN_PARAM);
  redirect(back ? safeReturnPath(back) : "/connexion");
}
