import "server-only";
import { and, asc, count, eq, exists, ne, or, sql } from "drizzle-orm";
import type { ShopMember } from "@/lib/auth/session";
import { byName, getDb, isUniqueViolation, schema, type Tx } from "@/lib/db";
import type { Member, MemberRole } from "@/lib/db/schema";
import { UserError } from "@/lib/errors";
import { PAGE_SIZE, offsetOf } from "@/lib/pagination";

/** Accounts and their role in each shop. Passwords arrive here already hashed. */

/** Number of accounts, all shops together: none before the first gérant is created. */
export async function accountCount() {
  const [{ total }] = await getDb().select({ total: count() }).from(schema.members);
  return total;
}

export async function accountByUsername(username: string): Promise<Member | undefined> {
  const [member] = await getDb()
    .select()
    .from(schema.members)
    .where(eq(schema.members.username, username))
    .limit(1);
  return member;
}

/**
 * True when the account may sign in: the super admin always, anyone else
 * while they have a role other than deactivated in at least one shop.
 */
export async function canSignIn(account: Pick<Member, "id" | "superAdmin">) {
  if (account.superAdmin) return true;
  const m = schema.shopMembers;
  const [row] = await getDb()
    .select({ shopId: m.shopId })
    .from(m)
    .where(and(eq(m.memberId, account.id), ne(m.role, "desactive")))
    .limit(1);
  return row !== undefined;
}

/**
 * Creates the first gérant, super admin, in the given shop. Only works while
 * there is no account at all: returns null otherwise.
 */
export async function createFirstGerant(
  shopId: number,
  { username, name, passwordHash }: { username: string; name: string; passwordHash: string },
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`lock table members in share row exclusive mode`);
    const [{ total }] = await tx.select({ total: count() }).from(schema.members);
    if (total > 0) return null;
    const [member] = await tx
      .insert(schema.members)
      .values({ username, name, passwordHash, role: "gerant", superAdmin: true })
      .returning();
    await tx.insert(schema.shopMembers).values({ shopId, memberId: member.id, role: "gerant" });
    return member;
  });
}

type NewAccount = { username: string; name: string; passwordHash: string };

/** Creates an account, with no shop yet, inside `tx`. Refuses a username already taken. */
export async function insertAccount(tx: Tx, { username, name, passwordHash }: NewAccount, role: MemberRole = "employe") {
  try {
    const [member] = await tx.insert(schema.members).values({ username, name, role, passwordHash }).returning();
    return member;
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError("Cet identifiant est déjà pris.");
    throw error;
  }
}

/** Creates an account with its role in the gérant's shop. */
export async function createAccount(shopId: number, { role, ...account }: NewAccount & { role: MemberRole }) {
  await getDb().transaction(async (tx) => {
    const member = await insertAccount(tx, account, role);
    await tx.insert(schema.shopMembers).values({ shopId, memberId: member.id, role });
  });
}

/**
 * The accounts a gérant may change: those of their shop. Only the super admin
 * themself may change their account; to anyone else the update matches no row.
 */
function editableBy(me: Pick<ShopMember, "id" | "shopId">, id: number) {
  return and(
    eq(schema.members.id, id),
    or(eq(schema.members.superAdmin, false), eq(schema.members.id, me.id)),
    exists(
      getDb()
        .select({ one: sql`1` })
        .from(schema.shopMembers)
        .where(and(eq(schema.shopMembers.shopId, me.shopId), eq(schema.shopMembers.memberId, schema.members.id))),
    ),
  );
}

/**
 * Renames an account of the gérant's shop and sets its role there. A gérant
 * cannot demote themself, so the shop always keeps a gérant, and the super
 * admin stays a gérant.
 */
export async function updateAccount(me: Pick<ShopMember, "id" | "shopId">, id: number, name: string, role: MemberRole) {
  await getDb().transaction(async (tx) => {
    const [member] = await tx
      .update(schema.members)
      .set({ name })
      .where(editableBy(me, id))
      .returning({ id: schema.members.id, superAdmin: schema.members.superAdmin });
    if (!member) return;
    await tx
      .update(schema.shopMembers)
      .set({ role: id === me.id || member.superAdmin ? "gerant" : role })
      .where(and(eq(schema.shopMembers.shopId, me.shopId), eq(schema.shopMembers.memberId, id)));
  });
}

/** A gérant gives an account of their shop a new password. */
export async function resetAccountPassword(me: Pick<ShopMember, "id" | "shopId">, id: number, passwordHash: string) {
  const changed = await getDb()
    .update(schema.members)
    .set({ passwordHash })
    .where(editableBy(me, id))
    .returning({ id: schema.members.id });
  if (changed.length === 0) throw new UserError("Ce compte est protégé.");
}

/** A member changes their own password. */
export async function setOwnPassword(memberId: number, passwordHash: string) {
  await getDb().update(schema.members).set({ passwordHash }).where(eq(schema.members.id, memberId));
}

/** One page of the shop's accounts, by name, with their role there. */
export async function shopMemberPage(shopId: number, page: number) {
  const m = schema.members;
  const sm = schema.shopMembers;
  const inShop = eq(sm.shopId, shopId);
  const [members, [{ total }]] = await Promise.all([
    getDb()
      .select({ id: m.id, username: m.username, name: m.name, superAdmin: m.superAdmin, role: sm.role })
      .from(m)
      .innerJoin(sm, eq(sm.memberId, m.id))
      .where(inShop)
      .orderBy(byName(m.name), asc(m.id))
      .limit(PAGE_SIZE)
      .offset(offsetOf(page)),
    getDb().select({ total: count() }).from(sm).where(inShop),
  ]);
  return { members, total };
}

/** A member of the shop, or undefined. */
export async function shopMemberOf(shopId: number, id: number) {
  const [member] = await getDb()
    .select({ id: schema.members.id, name: schema.members.name })
    .from(schema.members)
    .innerJoin(schema.shopMembers, eq(schema.shopMembers.memberId, schema.members.id))
    .where(and(eq(schema.members.id, id), eq(schema.shopMembers.shopId, shopId)))
    .limit(1);
  return member;
}
