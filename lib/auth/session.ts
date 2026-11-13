import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { getDb, schema } from "@/lib/db";
import type { Member, MemberRole, Shop } from "@/lib/db/schema";
import { authKey } from "@/lib/auth/key";
import { canSignIn } from "@/lib/members";
import { shopPath } from "@/lib/paths";
import { PATH_HEADER, loginUrl } from "@/lib/auth/return-path";
import { currentShop } from "@/lib/shops";

const COOKIE = "comptoir_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export { authConfigured } from "@/lib/auth/key";

type SessionKeys = Pick<Member, "id" | "passwordHash" | "discordId">;

// Ties a session to the password and the Discord account it was opened with:
// changing or resetting a password, or linking or unlinking Discord, signs the
// member out of every other device. Without Discord the stamp is the one
// sessions had before Discord, so they stay open.
function accountStamp({ passwordHash, discordId }: SessionKeys) {
  const keys = discordId ? `${passwordHash}\n${discordId}` : passwordHash;
  return createHash("sha256").update(keys).digest("base64url").slice(0, 16);
}

export async function startSession(member: SessionKeys) {
  const token = await new SignJWT({ pw: accountStamp(member) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(member.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(authKey());
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
    const { payload } = await jwtVerify(token, authKey(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) return null;
    const [member] = await getDb()
      .select()
      .from(schema.members)
      .where(eq(schema.members.id, id))
      .limit(1);
    if (!member || payload.pw !== accountStamp(member)) return null;
    return member;
  } catch {
    return null;
  }
});

/**
 * The signed-in account, outside any shop (Mes boutiques, an invitation…).
 * Not signed in, or deactivated everywhere (so unable to sign in again), it
 * goes to the login page, which brings it back to `path`.
 */
export async function requireAccount(path: string): Promise<Member> {
  const account = await currentAccount();
  if (!account || !(await canSignIn(account))) redirect(loginUrl(path));
  return account;
}

/**
 * A signed-in account inside the shop being visited: `role` is its role in
 * that shop, and `shopId` the shop every query of the page or action is about.
 */
export type ShopMember = Member & { shopId: number; shop: Shop };

/**
 * The signed-in member of the current shop, or null. The role is always read
 * fresh from the database. The super admin is a gérant in every shop; anyone
 * else needs a role there, and a deactivated member is signed out of it.
 */
export const currentMember = cache(async function currentMember(): Promise<ShopMember | null> {
  const account = await currentAccount();
  if (!account) return null;
  const shop = await currentShop();
  if (account.superAdmin) return { ...account, role: "gerant", shopId: shop.id, shop };
  const [membership] = await getDb()
    .select({ role: schema.shopMembers.role })
    .from(schema.shopMembers)
    .where(and(eq(schema.shopMembers.shopId, shop.id), eq(schema.shopMembers.memberId, account.id)))
    .limit(1);
  if (!membership || membership.role === "desactive") return null;
  return { ...account, role: membership.role, shopId: shop.id, shop };
});

/**
 * Redirects away unless the member is signed in with one of the given roles
 * in the shop being visited. A visitor who isn't signed in goes to the login
 * page, which brings them back to the page they asked for; an account with no
 * role in this shop goes to the choice of its own shops; a role that isn't
 * enough goes back to the shop's Grand livre.
 */
export async function requireMember(
  roles: MemberRole[] = ["gerant", "employe"],
): Promise<ShopMember> {
  const member = await currentMember();
  if (!member) {
    if (await currentAccount()) redirect("/");
    redirect(loginUrl((await headers()).get(PATH_HEADER)));
  }
  if (!roles.includes(member.role)) redirect(shopPath(member.shop.slug));
  return member;
}
