import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema, type Tx } from "@/lib/db";
import type { Member, Shop } from "@/lib/db/schema";
import { UserError } from "@/lib/errors";
import { insertAccount } from "@/lib/members";
import { canOpenShop } from "@/lib/policies";
import { insertShop } from "@/lib/shops";

/**
 * Invitation links: the super admin opens a shop for someone and gives them
 * /invitation/<token>; whoever opens it first becomes its gérant, with their
 * account or a new one. A link works once.
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

/** The links not used yet, newest first, with their shop. */
export async function pendingInvitations() {
  const i = schema.shopInvitations;
  return getDb()
    .select({ id: i.id, token: i.token, createdAt: i.createdAt, shopName: schema.shops.name, shopSlug: schema.shops.slug })
    .from(i)
    .innerJoin(schema.shops, eq(schema.shops.id, i.shopId))
    .where(isNull(i.usedAt))
    .orderBy(desc(i.createdAt), desc(i.id));
}

/** The shop an unused link opens, or undefined. */
export async function invitedShop(token: string): Promise<Shop | undefined> {
  const i = schema.shopInvitations;
  const [row] = await getDb()
    .select({ shop: schema.shops })
    .from(i)
    .innerJoin(schema.shops, eq(schema.shops.id, i.shopId))
    .where(and(eq(i.token, token), isNull(i.usedAt)))
    .limit(1);
  return row?.shop;
}

/** Spends the link for `memberId` and makes them gérant of its shop, inside `tx`. */
async function spend(tx: Tx, token: string, memberId: number): Promise<Shop> {
  const i = schema.shopInvitations;
  const [used] = await tx
    .update(i)
    .set({ usedAt: new Date(), usedBy: memberId })
    .where(and(eq(i.token, token), isNull(i.usedAt)))
    .returning({ shopId: i.shopId });
  if (!used) throw new UserError(SPENT);
  await tx
    .insert(schema.shopMembers)
    .values({ shopId: used.shopId, memberId, role: "gerant" })
    .onConflictDoUpdate({ target: [schema.shopMembers.shopId, schema.shopMembers.memberId], set: { role: "gerant" } });
  const [shop] = await tx.select().from(schema.shops).where(eq(schema.shops.id, used.shopId));
  return shop;
}

/** An existing account takes the link: it becomes gérant of the shop. */
export async function acceptInvitation(token: string, account: Pick<Member, "id">): Promise<Shop> {
  return getDb().transaction((tx) => spend(tx, token, account.id));
}

/** Someone with no account yet takes the link: their account is created, gérant of the shop. */
export async function signUpWithInvitation(
  token: string,
  { username, name, passwordHash }: { username: string; name: string; passwordHash: string },
): Promise<{ member: Member; shop: Shop }> {
  return getDb().transaction(async (tx) => {
    const member = await insertAccount(tx, { username, name, passwordHash }, "gerant");
    return { member, shop: await spend(tx, token, member.id) };
  });
}
