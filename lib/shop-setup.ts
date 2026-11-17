import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Shop } from "@/lib/db/schema";
import { UserError } from "@/lib/errors";
import { isGerant } from "@/lib/policies";
import type { ShopMember } from "@/lib/auth/session";
import { recordCashLine } from "@/lib/transactions";

/** The reason of the cash movement that puts the till's starting septims in the register. */
export const OPENING_TILL_LABEL = "Caisse de départ";

/**
 * Where the setting up of a new shop stands, or null when it is not offered:
 * a shop opened from Mes boutiques, not skipped, with no merchandise in
 * stock. `tillDone` once the register has a line (the opening till, or
 * anything written since).
 */
export async function shopSetup(shop: Pick<Shop, "id" | "setupPending">) {
  if (!shop.setupPending) return null;
  const db = getDb();
  const [[stocked], [written]] = await Promise.all([
    db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(eq(schema.products.shopId, shop.id), gt(schema.products.stock, 0)))
      .limit(1),
    db
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.shopId, shop.id), isNull(schema.transactions.cancelledAt)))
      .limit(1),
  ]);
  if (stocked) return null;
  return { tillDone: Boolean(written) };
}

/** A gérant writes what the till of the new shop holds, as a cash movement in. Returns its line's id. */
export async function recordOpeningTill(member: Pick<ShopMember, "id" | "role" | "shopId" | "shop">, amount: number) {
  if (!isGerant(member)) throw new UserError("Seul un gérant initialise la boutique.");
  const setup = await shopSetup(member.shop);
  if (!setup) throw new UserError("La boutique est déjà initialisée.");
  if (setup.tillDone) throw new UserError("La caisse de départ est déjà inscrite.");
  return recordCashLine(member, {
    kind: "entree",
    label: OPENING_TILL_LABEL,
    amount,
    counterparty: null,
    notes: null,
    tillPending: false,
  });
}

/** The shop is no longer offered to be set up: its gérant skipped it, or counted its stock. */
export async function endShopSetup(shopId: number) {
  await getDb().update(schema.shops).set({ setupPending: false }).where(eq(schema.shops.id, shopId));
}
