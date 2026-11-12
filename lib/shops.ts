import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, asc, eq, ne, type AnyColumn } from "drizzle-orm";
import { PATH_HEADER } from "@/lib/auth/return-path";
import { byName, getDb, isUniqueViolation, schema, type Tx } from "@/lib/db";
import type { Member, MemberRole, Shop } from "@/lib/db/schema";
import { UserError } from "@/lib/errors";
import { RESERVED_SLUGS, isComptoir, slugOf, slugify } from "@/lib/paths";

export async function shopBySlug(slug: string): Promise<Shop | undefined> {
  const [shop] = await getDb().select().from(schema.shops).where(eq(schema.shops.slug, slug)).limit(1);
  return shop;
}

/** The first shop, the comptoir: where the very first gérant is created. */
export async function firstShop(): Promise<Shop> {
  const [shop] = await getDb().select().from(schema.shops).orderBy(asc(schema.shops.id)).limit(1);
  if (!shop) throw new Error("Aucune boutique : les migrations n'ont pas été appliquées.");
  return shop;
}

/**
 * The shop being visited, named by the first segment of the address
 * (/<slug>/…), which proxy.ts passes to pages and Server Actions alike.
 * Every page and action reads and writes the data of this shop only. An
 * address naming no shop is a page that doesn't exist.
 */
export const currentShop = cache(async function currentShop(): Promise<Shop> {
  const slug = slugOf((await headers()).get(PATH_HEADER));
  const shop = slug ? await shopBySlug(slug) : undefined;
  if (!shop) notFound();
  return shop;
});

export type AccountShop = Pick<Shop, "id" | "name" | "slug"> & { role: MemberRole };

/**
 * The shops an account may enter, by name, with its role in each: those where
 * it has a role other than deactivated, and every shop for the super admin.
 */
export async function accountShops(account: Pick<Member, "id" | "superAdmin">): Promise<AccountShop[]> {
  const s = schema.shops;
  const sm = schema.shopMembers;
  if (account.superAdmin) {
    const shops = await getDb()
      .select({ id: s.id, name: s.name, slug: s.slug })
      .from(s)
      .orderBy(byName(s.name), asc(s.id));
    return shops.map((shop) => ({ ...shop, role: "gerant" }));
  }
  return getDb()
    .select({ id: s.id, name: s.name, slug: s.slug, role: sm.role })
    .from(s)
    .innerJoin(sm, eq(sm.shopId, s.id))
    .where(and(eq(sm.memberId, account.id), ne(sm.role, "desactive")))
    .orderBy(byName(s.name), asc(s.id));
}

/** Refuses an address with no letter or digit, or one the app uses for its own pages. */
function checkSlug(slug: string) {
  if (!slug) throw new UserError("Le nom de la boutique doit contenir au moins une lettre ou un chiffre.");
  if (RESERVED_SLUGS.includes(slug)) throw new UserError(`L'adresse /${slug} est réservée : choisis un autre nom.`);
}

/** Runs a write that sets a shop's address, refusing one another shop already has. */
async function claimingSlug<T>(slug: string, write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError(`Une boutique a déjà l'adresse /${slug} : choisis un autre nom.`);
    throw error;
  }
}

/** Opens a shop named `name` at the address made from it, inside `tx`. */
export async function insertShop(tx: Tx, name: string): Promise<Shop> {
  const slug = slugify(name);
  checkSlug(slug);
  return claimingSlug(slug, async () => {
    const [shop] = await tx.insert(schema.shops).values({ name, slug }).returning();
    return shop;
  });
}

/** Opens a shop named `name`, whose first gérant is the account that opens it. */
export async function createShop(account: Pick<Member, "id">, name: string): Promise<Shop> {
  return getDb().transaction(async (tx) => {
    const shop = await insertShop(tx, name);
    await tx.insert(schema.shopMembers).values({ shopId: shop.id, memberId: account.id, role: "gerant" });
    return shop;
  });
}

/**
 * Renames a shop and moves it to the address made from `address`. The
 * comptoir keeps its address, which its old links lead to.
 */
export async function updateShop(shop: Shop, name: string, address: string): Promise<Shop> {
  const slug = isComptoir(shop) ? shop.slug : slugify(address);
  checkSlug(slug);
  return claimingSlug(slug, async () => {
    const [updated] = await getDb()
      .update(schema.shops)
      .set({ name, slug })
      .where(eq(schema.shops.id, shop.id))
      .returning();
    return updated;
  });
}

/**
 * A gérant deletes a shop with everything in it: merchandises, register,
 * stock history, board, suppliers, settings, invitations and memberships,
 * once they have typed its name again. The accounts stay, but one left
 * with no shop can't sign in any more: a gérant keeps at least one shop
 * (the super admin always has the comptoir, which can't be deleted).
 */
export async function deleteShop(gerant: Pick<Member, "id" | "superAdmin">, shop: Shop, typedName: string) {
  if (isComptoir(shop)) throw new UserError("Le comptoir ne peut pas être supprimé.");
  if (typedName !== shop.name) throw new UserError("Écris exactement le nom de la boutique pour confirmer.");
  const others = (await accountShops(gerant)).filter(({ id }) => id !== shop.id);
  if (others.length === 0) {
    throw new UserError("C'est ta seule boutique : ouvre-en une autre avant de supprimer celle-ci.");
  }
  await getDb().transaction(async (tx) => {
    const of = <T extends { shopId: AnyColumn }>(table: T) => eq(table.shopId, shop.id);
    // Supplier offers go with their supplier; every other table names the shop.
    await tx.delete(schema.suppliers).where(of(schema.suppliers));
    await tx.delete(schema.stockMovements).where(of(schema.stockMovements));
    await tx.delete(schema.transactions).where(of(schema.transactions));
    await tx.delete(schema.products).where(of(schema.products));
    await tx.delete(schema.announcements).where(of(schema.announcements));
    await tx.delete(schema.settings).where(of(schema.settings));
    await tx.delete(schema.shopInvitations).where(of(schema.shopInvitations));
    await tx.delete(schema.shopMembers).where(of(schema.shopMembers));
    await tx.delete(schema.shops).where(eq(schema.shops.id, shop.id));
  });
}
