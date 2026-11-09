import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { getDb, schema } from "@/lib/db";
import type { Member, MemberRole } from "@/lib/db/schema";

const COOKIE = "comptoir_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(value);
}

export async function startSession(memberId: number) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(memberId))
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

/** The signed-in member, or null. Role is always read fresh from the database. */
export const currentMember = cache(async function currentMember(): Promise<Member | null> {
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
    return member ?? null;
  } catch {
    return null;
  }
});

export const STAFF: MemberRole[] = ["gerant", "employe"];

/** Redirects away unless the member is signed in with one of the given roles. */
export async function requireMember(roles: MemberRole[] = STAFF): Promise<Member> {
  const member = await currentMember();
  if (!member) redirect("/connexion");
  if (!roles.includes(member.role)) {
    redirect(STAFF.includes(member.role) ? "/" : "/attente");
  }
  return member;
}
