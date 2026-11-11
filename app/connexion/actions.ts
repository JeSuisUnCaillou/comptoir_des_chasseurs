"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/lib/db";
import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  normalizeUsername,
  verifyPassword,
} from "@/lib/auth/password";
import { RETURN_PARAM, safeReturnPath } from "@/lib/auth/return-path";
import { endSession, startSession } from "@/lib/auth/session";
import { currentShop } from "@/lib/shops";

export type AuthState = { error: string } | null;

// Compared against when the username is unknown, so both cases take as long.
const DUMMY_HASH =
  "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const password = String(formData.get("password") ?? "");
  const [member] = await getDb()
    .select()
    .from(schema.members)
    .where(eq(schema.members.username, username))
    .limit(1);
  const valid = await verifyPassword(password, member?.passwordHash ?? DUMMY_HASH);
  if (!member || !valid || !(member.superAdmin || (await hasActiveShop(member.id)))) {
    return { error: "Identifiant ou mot de passe incorrect." };
  }
  await startSession(member);
  redirect(safeReturnPath(formData.get(RETURN_PARAM)));
}

/** True when the member may enter at least one shop: deactivated everywhere, they can't sign in. */
async function hasActiveShop(memberId: number) {
  const m = schema.shopMembers;
  const [row] = await getDb()
    .select({ shopId: m.shopId })
    .from(m)
    .where(and(eq(m.memberId, memberId), ne(m.role, "desactive")))
    .limit(1);
  return row !== undefined;
}

/** Creates the first gérant. Only works while there is no member at all. */
export async function createFirstGerant(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(formData.get("username"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const password = String(formData.get("password") ?? "");
  if (!username || !name) return { error: "Identifiant et nom sont obligatoires." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  if (password !== formData.get("confirm")) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }
  const passwordHash = await hashPassword(password);

  const created = await getDb().transaction(async (tx) => {
    await tx.execute(sql`lock table members in share row exclusive mode`);
    const [{ total }] = await tx.select({ total: count() }).from(schema.members);
    if (total > 0) return null;
    const [member] = await tx
      .insert(schema.members)
      .values({ username, name, passwordHash, role: "gerant", superAdmin: true })
      .returning();
    const shop = await currentShop();
    await tx.insert(schema.shopMembers).values({ shopId: shop.id, memberId: member.id, role: "gerant" });
    return member;
  });
  if (!created) return { error: "Le comptoir a déjà un gérant. Connecte-toi." };
  await startSession(created);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/connexion");
}
