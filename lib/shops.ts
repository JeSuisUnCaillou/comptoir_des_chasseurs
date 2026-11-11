import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { PATH_HEADER } from "@/lib/auth/return-path";
import { byName, getDb, schema } from "@/lib/db";
import type { Member, MemberRole, Shop } from "@/lib/db/schema";
import { slugOf } from "@/lib/paths";

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
