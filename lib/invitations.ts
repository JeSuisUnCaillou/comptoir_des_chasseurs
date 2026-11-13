import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema, type Tx } from "@/lib/db";
import type { Member, MemberRole, Shop } from "@/lib/db/schema";
import type { ShopMember } from "@/lib/auth/session";
import { NO_PASSWORD } from "@/lib/auth/password";
import { UserError } from "@/lib/errors";
import { accountByDiscordId, freeUsername, insertAccount } from "@/lib/members";
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

/**
 * A gérant invites someone into their shop as an employé, named beforehand
 * or not: the token of the link.
 */
export async function createEmployeeInvitation(gerant: Pick<ShopMember, "id" | "role" | "shopId">, name: string | null) {
  if (!isGerant(gerant)) throw new UserError("Seul un gérant peut inviter dans la boutique.");
  const token = randomBytes(24).toString("base64url");
  await getDb()
    .insert(schema.shopInvitations)
    .values({ token, shopId: gerant.shopId, createdBy: gerant.id, role: "employe", name });
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
    .select({ id: i.id, token: i.token, createdAt: i.createdAt, name: i.name })
    .from(i)
    .where(and(eq(i.shopId, shopId), isNull(i.usedAt), eq(i.role, "employe")))
    .orderBy(desc(i.createdAt), desc(i.id));
}

/** The shop an unused link opens, the role it gives there and the name it was made for, or undefined. */
export async function invitationOf(
  token: string,
): Promise<{ shop: Shop; role: MemberRole; name: string | null } | undefined> {
  const i = schema.shopInvitations;
  const [row] = await getDb()
    .select({ shop: schema.shops, role: i.role, name: i.name })
    .from(i)
    .innerJoin(schema.shops, eq(schema.shops.id, i.shopId))
    .where(and(eq(i.token, token), isNull(i.usedAt)))
    .limit(1);
  return row;
}

type Claimed = { id: number; shopId: number; role: MemberRole; name: string | null };

/** Marks the link used, inside `tx`: what it gives. Refused once spent. */
async function claim(tx: Tx, token: string): Promise<Claimed> {
  const i = schema.shopInvitations;
  const [claimed] = await tx
    .update(i)
    .set({ usedAt: new Date() })
    .where(and(eq(i.token, token), isNull(i.usedAt)))
    .returning({ id: i.id, shopId: i.shopId, role: i.role, name: i.name });
  if (!claimed) throw new UserError(SPENT);
  return claimed;
}

/**
 * Gives `memberId` the claimed link's role in its shop, inside `tx`. An
 * employé link leaves a member of the shop as they were: it never demotes a
 * gérant, nor brings back an account a gérant deactivated.
 */
async function join(tx: Tx, claimed: Claimed, memberId: number): Promise<Shop> {
  await tx.update(schema.shopInvitations).set({ usedBy: memberId }).where(eq(schema.shopInvitations.id, claimed.id));
  const target = [schema.shopMembers.shopId, schema.shopMembers.memberId];
  const membership = tx.insert(schema.shopMembers).values({ shopId: claimed.shopId, memberId, role: claimed.role });
  await (claimed.role === "gerant"
    ? membership.onConflictDoUpdate({ target, set: { role: "gerant" } })
    : membership.onConflictDoNothing({ target }));
  const [shop] = await tx.select().from(schema.shops).where(eq(schema.shops.id, claimed.shopId));
  return shop;
}

/** An existing account takes the link: it gets the link's role in the shop. */
export async function acceptInvitation(token: string, account: Pick<Member, "id">): Promise<Shop> {
  return getDb().transaction(async (tx) => join(tx, await claim(tx, token), account.id));
}

/** Someone with no account yet takes the link: their account is created, with the link's role in the shop. */
export async function signUpWithInvitation(
  token: string,
  { username, name, passwordHash }: { username: string; name: string; passwordHash: string },
): Promise<{ member: Member; shop: Shop }> {
  return getDb().transaction(async (tx) => {
    const claimed = await claim(tx, token);
    const member = await insertAccount(tx, { username, name, passwordHash });
    return { member, shop: await join(tx, claimed, member.id) };
  });
}

/**
 * Someone with no account takes the link with Discord: their account has no
 * password (they may choose one later), its username comes from Discord, its
 * name from the link (or else Discord), and Discord opens it.
 */
export async function signUpWithDiscord(
  token: string,
  discord: { id: string; name: string; username: string },
): Promise<{ member: Member; shop: Shop }> {
  return getDb().transaction(async (tx) => {
    const claimed = await claim(tx, token);
    const username = await freeUsername(tx, discord.username);
    const member = await insertAccount(tx, {
      username,
      name: (claimed.name ?? discord.name).slice(0, 60),
      passwordHash: NO_PASSWORD,
      discordId: discord.id,
      discordName: discord.name,
    });
    return { member, shop: await join(tx, claimed, member.id) };
  });
}

/**
 * Someone takes the link with Discord: the account linked to this Discord
 * takes it as is, or else one is created (signUpWithDiscord).
 */
export async function takeInvitationWithDiscord(
  token: string,
  discord: { id: string; name: string; username: string },
): Promise<{ member: Member; shop: Shop }> {
  const known = await accountByDiscordId(discord.id);
  if (known) return { member: known, shop: await acceptInvitation(token, known) };
  return signUpWithDiscord(token, discord);
}
