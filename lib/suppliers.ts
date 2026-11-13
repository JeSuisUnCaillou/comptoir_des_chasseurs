import "server-only";
import { and, asc, count, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { byName, containing, getDb, isUniqueViolation, schema } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { offsetOf } from "@/lib/pagination";
import type { OfferSide } from "@/lib/db/schema";

export const SUPPLIER_PAGE_SIZE = 12;

export type SupplierOfferRow = {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  price: number;
  qty: number;
  side: OfferSide;
};

export type SupplierWithOffers = typeof schema.suppliers.$inferSelect & { offers: SupplierOfferRow[] };

/** The shop's contacts (suppliers and customers) matching a name, place, note, or a merchandise they offer. */
function searchWhere(shopId: number, q: string) {
  const inShop = eq(schema.suppliers.shopId, shopId);
  if (!q) return inShop;
  const pattern = containing(q);
  const { suppliers, supplierOffers, products } = schema;
  return and(
    inShop,
    or(
      ilike(suppliers.name, pattern),
      ilike(suppliers.place, pattern),
      ilike(suppliers.notes, pattern),
      exists(
        getDb()
          .select({ one: supplierOffers.id })
          .from(supplierOffers)
          .innerJoin(products, eq(products.id, supplierOffers.productId))
          .where(and(eq(supplierOffers.supplierId, suppliers.id), ilike(products.name, pattern))),
      ),
    ),
  );
}

/** Offers of the given suppliers, by merchandise name. */
export async function offersOf(supplierIds: number[]) {
  const byId = new Map<number, SupplierOfferRow[]>(supplierIds.map((id) => [id, []]));
  if (supplierIds.length === 0) return byId;
  const { supplierOffers, products } = schema;
  const rows = await getDb()
    .select({
      id: supplierOffers.id,
      supplierId: supplierOffers.supplierId,
      productId: products.id,
      productName: products.name,
      unit: products.unit,
      price: supplierOffers.price,
      qty: supplierOffers.qty,
      side: supplierOffers.side,
    })
    .from(supplierOffers)
    .innerJoin(products, eq(products.id, supplierOffers.productId))
    .where(inArray(supplierOffers.supplierId, supplierIds))
    .orderBy(byName(products.name), asc(supplierOffers.id));
  for (const { supplierId, ...offer } of rows) byId.get(supplierId)?.push(offer);
  return byId;
}

/** One page of suppliers, by name, with what they offer. */
export async function supplierPage(shopId: number, q: string, page: number) {
  const where = searchWhere(shopId, q);
  const db = getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(schema.suppliers)
      .where(where)
      .orderBy(byName(schema.suppliers.name), asc(schema.suppliers.id))
      .limit(SUPPLIER_PAGE_SIZE)
      .offset(offsetOf(page, SUPPLIER_PAGE_SIZE)),
    db.select({ total: count() }).from(schema.suppliers).where(where),
  ]);
  const offers = await offersOf(rows.map((s) => s.id));
  const suppliers: SupplierWithOffers[] = rows.map((s) => ({ ...s, offers: offers.get(s.id) ?? [] }));
  return { suppliers, total };
}

/** A supplier of the shop, or undefined. */
export async function supplierOf(shopId: number, id: number) {
  const [supplier] = await getDb()
    .select()
    .from(schema.suppliers)
    .where(and(eq(schema.suppliers.id, id), eq(schema.suppliers.shopId, shopId)))
    .limit(1);
  return supplier;
}

/** Creates a supplier of the shop, or updates it when `id` is given. Returns its id. */
export async function saveSupplier(
  shopId: number,
  id: number | null,
  values: { name: string; place: string; notes: string },
) {
  try {
    if (id != null) {
      const updated = await getDb()
        .update(schema.suppliers)
        .set(values)
        .where(and(eq(schema.suppliers.id, id), eq(schema.suppliers.shopId, shopId)))
        .returning({ id: schema.suppliers.id });
      if (updated.length === 0) throw new UserError("Ce contact n'existe plus.");
      return id;
    }
    const [created] = await getDb()
      .insert(schema.suppliers)
      .values({ ...values, shopId })
      .returning({ id: schema.suppliers.id });
    return created.id;
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserError("Il y a déjà un contact à ce nom.");
    throw error;
  }
}

/**
 * Adds a merchandise to a contact of the shop, sold to us or bought from us,
 * or changes its price and side if it is already listed.
 */
export async function saveOffer(
  shopId: number,
  {
    supplierId,
    productId,
    price,
    qty,
    side,
  }: { supplierId: number; productId: number; price: number; qty: number; side: OfferSide },
) {
  const db = getDb();
  const [[supplier], [product]] = await Promise.all([
    db
      .select({ id: schema.suppliers.id })
      .from(schema.suppliers)
      .where(and(eq(schema.suppliers.id, supplierId), eq(schema.suppliers.shopId, shopId))),
    db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(and(eq(schema.products.id, productId), eq(schema.products.shopId, shopId))),
  ]);
  if (!supplier) throw new UserError("Ce contact n'existe plus.");
  if (!product) throw new UserError("Marchandise inconnue.");
  await db
    .insert(schema.supplierOffers)
    .values({ supplierId, productId, price, qty, side })
    .onConflictDoUpdate({
      target: [schema.supplierOffers.supplierId, schema.supplierOffers.productId],
      set: { price, qty, side },
    });
}

/** Takes a merchandise off a supplier of the shop. */
export async function removeOffer(shopId: number, supplierId: number, offerId: number) {
  await getDb()
    .delete(schema.supplierOffers)
    .where(
      and(
        eq(schema.supplierOffers.id, offerId),
        eq(schema.supplierOffers.supplierId, supplierId),
        inArray(
          schema.supplierOffers.supplierId,
          getDb().select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.shopId, shopId)),
        ),
      ),
    );
}

/** Deletes a supplier of the shop; its offers go with it (on delete cascade). */
export async function deleteSupplier(shopId: number, id: number) {
  await getDb()
    .delete(schema.suppliers)
    .where(and(eq(schema.suppliers.id, id), eq(schema.suppliers.shopId, shopId)));
}

/**
 * The shop's contacts by name, for the name field of a purchase or a sale:
 * those who go `side` (suppliers for a purchase, customers for a sale) first,
 * under their own heading, then the others.
 */
export async function contactNames(shopId: number, side: OfferSide) {
  const { suppliers, supplierOffers } = schema;
  const rows = await getDb()
    .select({
      id: suppliers.id,
      name: suppliers.name,
      first: sql<boolean>`coalesce(bool_or(${supplierOffers.side} = ${side}), false)`,
    })
    .from(suppliers)
    .leftJoin(supplierOffers, eq(supplierOffers.supplierId, suppliers.id))
    .where(eq(suppliers.shopId, shopId))
    .groupBy(suppliers.id)
    .orderBy(byName(suppliers.name), asc(suppliers.id));
  // Headings only when someone goes this way.
  const grouped = rows.some((r) => r.first);
  const heading = side === "sells" ? "Fournisseurs" : "Clients";
  const named = rows.map(({ id, name, first }) => ({
    id,
    name,
    first,
    group: grouped ? (first ? heading : "Autres contacts") : undefined,
  }));
  return [...named.filter((r) => r.first), ...named.filter((r) => !r.first)].map(({ first: _, ...c }) => c);
}
