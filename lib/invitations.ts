import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema, type Tx } from "@/lib/db";
import type { Member, MemberRole, Shop } from "@/lib/db/schema";
import type { ShopMember } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { freeUsername, insertAccount } from "@/lib/members";
import { canOpenShop, isGerant } from "@/lib/policies";
import { insertShop } from "@/lib/shops";

/**
 * Invitation links, /invitation/<token>: the super admin opens a shop for
 * someone, who becomes its gérant; a gérant invites someone into their shop,
 * who becomes an employé. Whoever opens it first takes it, with their account
 * or a new one (with a password, or with Discord alone). A link works once.
 */

export const SPENT = "Cette invitation n'est plus valable : elle a déjà servi, ou le lien est incomplet.";

/** Opens a shop named `name` with no member yet, and the token of the link that makes someone its gérant. */
export async function createShopInvitation(superAdmin: Pick<Member, "id" | "superAdmin">, name: string) {
  if (!canOpenShop(superAdmin)) throw new UserError("Seul le super admin peut ouvrir une boutique.");
  return getDb().transaction(async (tx) => {
    const shop = await insertShop(tx, name);
    const token = randomBytes(24).toString("base64url");
    await tx.insert(schema.shopInvitations).values({ token, shopId: shop.id, createdBy: superAdmin.id });
    return { shop, token };
  });
}

/** A gérant invites someone into their shop as an employé: the token of the link. */
export async function createEmployeeInvitation(gerant: Pick<ShopMember, "id" | "role" | "shopId">) {
  if (!isGerant(gerant)) throw new UserError("Seul un gérant peut inviter dans la boutique.");
  const token = randomBytes(24).toString("base64url");
  await getDb()
    .insert(schema.shopInvitations)
    .values({ token, shopId: gerant.shopId, createdBy: gerant.id, role: "employe" });
  return token;
}

/** The links to run a new shop not used yet, newest first, with their shop. */
export async function pendingInvitations() {
  const i = schema.shopInvitations;
  return getDb()
    .select({ id: i.id, token: i.token, createdAt: i.createdAt, shopName: schema.shops.name, shopSlug: schema.shops.slug })
    .from(i)
    .innerJoin(schema.shops, eq(schema.shops.id, i.shopId))
    .where(and(isNull(i.usedAt), eq(i.role, "gerant")))
    .orderBy(desc(i.createdAt), desc(i.id));
}

/** The employé links of a shop not used yet, newest first. */
export async function pendingEmployeeInvitations(shopId: number) {
  const i = schema.shopInvitations;
  return getDb()
    .select({ id: i.id, token: i.token, createdAt: i.createdAt })
    .from(i)
    .where(and(eq(i.shopId, shopId), isNull(i.usedAt), eq(i.role, "employe")))
    .orderBy(desc(i.createdAt), desc(i.id));
}

/** The shop an unused link opens and the role it gives there, or undefined. */
export async function invitationOf(token: string): Promise<{ shop: Shop; role: MemberRole } | undefined> {
  const i = schema.shopInvitations;
  const [row] = await getDb()
    .select({ shop: schema.shops, role: i.role })
    .from(i)
    .innerJoin(schema.shops, eq(schema.shops.id, i.shopId))
    .where(and(eq(i.token, token), isNull(i.usedAt)))
    .limit(1);
  return row;
}

/**
 * Spends the link for `memberId` and gives them its role in its shop, inside
 * `tx`. An employé link leaves a member of the shop as they were: it never
 * demotes a gérant, nor brings back an account a gérant deactivated.
 */
async function spend(tx: Tx, token: string, memberId: number): Promise<Shop> {
  const i = schema.shopInvitations;
  const [used] = await tx
    .update(i)
    .set({ usedAt: new Date(), usedBy: memberId })
    .where(and(eq(i.token, token), isNull(i.usedAt)))
    .returning({ shopId: i.shopId, role: i.role });
  if (!used) throw new UserError(SPENT);
  const target = [schema.shopMembers.shopId, schema.shopMembers.memberId];
  const membership = tx.insert(schema.shopMembers).values({ shopId: used.shopId, memberId, role: used.role });
  await (used.role === "gerant"
    ? membership.onConflictDoUpdate({ target, set: { role: "gerant" } })
    : membership.onConflictDoNothing({ target }));
  const [shop] = await tx.select().from(schema.shops).where(eq(schema.shops.id, used.shopId));
  return shop;
}

/** An existing account takes the link: it gets the link's role in the shop. */
export async function acceptInvitation(token: string, account: Pick<Member, "id">): Promise<Shop> {
  return getDb().transaction((tx) => spend(tx, token, account.id));
}

/** Someone with no account yet takes the link: their account is created, with the link's role in the shop. */
export async function signUpWithInvitation(
  token: string,
  { username, name, passwordHash }: { username: string; name: string; passwordHash: string },
): Promise<{ member: Member; shop: Shop }> {
  return getDb().transaction(async (tx) => {
    const member = await insertAccount(tx, { username, name, passwordHash }, await linkRole(tx, token));
    return { member, shop: await spend(tx, token, member.id) };
  });
}

/**
 * Someone with no account takes the link with Discord: their account has no
 * password (they may choose one later), its name and username come from
 * Discord, and Discord opens it.
 */
export async function signUpWithDiscord(
  token: string,
  discord: { id: string; name: string; username: string },
): Promise<{ member: Member; shop: Shop }> {
  return getDb().transaction(async (tx) => {
    const username = await freeUsername(tx, discord.username);
    const member = await insertAccount(
      tx,
      { username, name: discord.name.slice(0, 60), passwordHash: "", discordId: discord.id, discordName: discord.name },
      await linkRole(tx, token),
    );
    return { member, shop: await spend(tx, token, member.id) };
  });
}

// The legacy members.role of a new account: the role the link gives.
async function linkRole(tx: Tx, token: string): Promise<MemberRole> {
  const i = schema.shopInvitations;
  const [row] = await tx.select({ role: i.role }).from(i).where(eq(i.token, token)).limit(1);
  return row?.role ?? "employe";
}
