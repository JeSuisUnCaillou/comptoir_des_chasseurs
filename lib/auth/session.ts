import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { getDb, schema } from "@/lib/db";
import type { Member, MemberRole } from "@/lib/db/schema";
import { PATH_HEADER, loginUrl } from "@/lib/auth/return-path";
import { currentShop } from "@/lib/shops";

const COOKIE = "comptoir_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export function authConfigured() {
  return (process.env.AUTH_SECRET?.length ?? 0) >= 32;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(value);
}

// Ties a session to the password it was opened with: changing or resetting a
// password signs the member out of every other device.
function passwordStamp(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}

export async function startSession(member: Pick<Member, "id" | "passwordHash">) {
  const token = await new SignJWT({ pw: passwordStamp(member.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(member.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in account, whatever its shops, or null. */
export const currentAccount = cache(async function currentAccount(): Promise<Member | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) return null;
    const [member] = await getDb()
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, id))
      .limit(1);
    if (!member || payload.pw !== passwordStamp(member.passwordHash)) return null;
    return member;
  } catch {
    return null;
  }
});

/**
 * A signed-in account inside the shop being visited: `role` is its role in
 * that shop, and `shopId` the shop every query of the page or action is about.
 */
export type ShopMember = Member & { shopId: number };

/**
 * The signed-in member of the current shop, or null. The role is always read
 * fresh from the database. The super admin is a gérant in every shop; anyone
 * else needs a role there, and a deactivated member is signed out of it.
 */
export const currentMember = cache(async function currentMember(): Promise<ShopMember | null> {
  const account = await currentAccount();
  if (!account) return null;
  const shop = await currentShop();
  if (account.superAdmin) return { ...account, role: "gerant", shopId: shop.id };
  const [membership] = await getDb()
    .select({ role: schema.shopMembers.role })
    .from(schema.shopMembers)
    .where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.memberId, account.id)))
    .limit(1);
  if (!membership || membership.role === "desactive") return null;
  return { ...account, role: membership.role, shopId: shop.id };
});

/**
 * Redirects away unless the member is signed in with one of the given roles.
 * A visitor who isn't signed in goes to the login page, which brings them
 * back to the page they asked for.
 */
export async function requireMember(
  roles: MemberRole[] = ["gerant", "employe"],
): Promise<ShopMember> {
  const member = await currentMember();
  if (!member) redirect(loginUrl((await headers()).get(PATH_HEADER)));
  if (!roles.includes(member.role)) redirect("/");
  return member;
}
