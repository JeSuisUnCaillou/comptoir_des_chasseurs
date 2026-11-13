import "server-only";
import { and, asc, count, eq, exists, like, ne, or, sql } from "drizzle-orm";
import { NO_PASSWORD } from "@/lib/auth/password";
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

export async function accountByDiscordId(discordId: string): Promise<Member | undefined> {
  const [member] = await getDb()
    .select()
    .from(schema.members)
    .where(eq(schema.members.discordId, discordId))
    .limit(1);
  return member;
}

/**
 * A member links their own account to a Discord account, replacing the one
 * linked before. Returns the account as it now is, to restart its session.
 */
export async function linkDiscord(memberId: number, discord: { id: string; name: string }): Promise<Member> {
  try {
    const [member] = await getDb()
      .update(schema.members)
      .set({ discordId: discord.id, discordName: discord.name })
      .where(eq(schema.members.id, memberId))
      .returning();
    return member;
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError("Ce compte Discord est déjà lié à un autre membre.");
    throw error;
  }
}

/**
 * A member unlinks Discord from their own account. Returns the account as it
 * now is. Refused without a password: nothing would open the account any more.
 */
export async function unlinkDiscord(memberId: number): Promise<Member> {
  const [member] = await getDb()
    .update(schema.members)
    .set({ discordId: null, discordName: null })
    .where(and(eq(schema.members.id, memberId), ne(schema.members.passwordHash, NO_PASSWORD)))
    .returning();
  if (!member) throw new UserError("Choisis d'abord un mot de passe : sans lui, plus rien n'ouvrirait ton compte.");
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

type NewAccount = {
  username: string;
  name: string;
  // NO_PASSWORD for an account opened with Discord alone, which has no password yet.
  passwordHash: string;
  discordId?: string;
  discordName?: string;
};

/**
 * A username nobody has, made from `wanted` (a Discord username): only the
 * characters usernames allow, then -2, -3… if it is taken.
 */
export async function freeUsername(tx: Tx, wanted: string) {
  const base = wanted.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 34) || "membre";
  const taken = new Set(
    (
      await tx
        .select({ username: schema.members.username })
        .from(schema.members)
        .where(like(schema.members.username, `${base}%`))
    ).map((row) => row.username),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Creates an account, with no shop yet, inside `tx`. Refuses a username already taken. */
export async function insertAccount(tx: Tx, account: NewAccount, role: MemberRole = "employe") {
  try {
    const [member] = await tx.insert(schema.members).values({ ...account, role }).returning();
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

/** The roles the role selector of Membres offers: deactivating has its own button. */
export type ActiveRole = Exclude<MemberRole, "desactive">;

/**
 * Renames an account of the gérant's shop and sets its role there, unless it
 * is deactivated there: reactivating has its own button. A gérant cannot
 * demote themself, so the shop always keeps a gérant, and the super admin
 * stays a gérant.
 */
export async function updateAccount(
  me: Pick<ShopMember, "id" | "shopId">,
  id: number,
  name: string,
  role: ActiveRole | null,
) {
  await getDb().transaction(async (tx) => {
    const [member] = await tx
      .update(schema.members)
      .set({ name })
      .where(editableBy(me, id))
      .returning({ id: schema.members.id, superAdmin: schema.members.superAdmin });
    if (!member || !role) return;
    await tx
      .update(schema.shopMembers)
      .set({ role: id === me.id || member.superAdmin ? "gerant" : role })
      .where(
        and(
          eq(schema.shopMembers.shopId, me.shopId),
          eq(schema.shopMembers.memberId, id),
          ne(schema.shopMembers.role, "desactive"),
        ),
      );
  });
}

/**
 * A gérant deactivates an account of their shop, or reactivates it as an
 * employé. Neither their own account nor the super admin's.
 */
export async function setAccountActive(me: Pick<ShopMember, "id" | "shopId">, id: number, active: boolean) {
  const sm = schema.shopMembers;
  if (id === me.id) throw new UserError("Tu ne peux pas désactiver ton propre compte.");
  const changed = await getDb()
    .update(sm)
    .set({ role: active ? "employe" : "desactive" })
    .where(
      and(
        eq(sm.shopId, me.shopId),
        eq(sm.memberId, id),
        active ? eq(sm.role, "desactive") : ne(sm.role, "desactive"),
        exists(
          getDb()
            .select({ one: sql`1` })
            .from(schema.members)
            .where(and(eq(schema.members.id, id), eq(schema.members.superAdmin, false))),
        ),
      ),
    )
    .returning({ id: sm.memberId });
  if (changed.length === 0) throw new UserError("Tu ne peux pas modifier ce compte.");
}

/** A gérant gives an account of their shop a new password. */
export async function resetAccountPassword(me: Pick<ShopMember, "id" | "shopId">, id: number, passwordHash: string) {
  const changed = await getDb()
    .update(schema.members)
    .set({ passwordHash })
    .where(editableBy(me, id))
    .returning({ id: schema.members.id });
  if (changed.length === 0) throw new UserError("Tu ne peux pas modifier ce compte.");
}

/** A member changes their own password. */
export async function setOwnPassword(memberId: number, passwordHash: string) {
  await getDb().update(schema.members).set({ passwordHash }).where(eq(schema.members.id, memberId));
}

/** One page of the shop's accounts, by name, deactivated ones last, with their role there. */
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
      .orderBy(sql`${sm.role} = 'desactive'`, byName(m.name), asc(m.id))
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
