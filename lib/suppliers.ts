import "server-only";
import { and, asc, count, eq, exists, ilike, inArray, or } from "drizzle-orm";
import { byName, getDb, schema } from "@/lib/db";
import { offsetOf } from "@/lib/pagination";

export const SUPPLIER_PAGE_SIZE = 12;

export type SupplierOfferRow = {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  price: number;
  qty: number;
};

export type SupplierWithOffers = typeof schema.suppliers.$inferSelect & { offers: SupplierOfferRow[] };

/** Matches a supplier's name, place, note, or a merchandise it offers. */
function searchWhere(q: string) {
  if (!q) return undefined;
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const { suppliers, supplierOffers, products } = schema;
  return or(
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
    })
    .from(supplierOffers)
    .innerJoin(products, eq(products.id, supplierOffers.productId))
    .where(inArray(supplierOffers.supplierId, supplierIds))
    .orderBy(byName(products.name), asc(supplierOffers.id));
  for (const { supplierId, ...offer } of rows) byId.get(supplierId)?.push(offer);
  return byId;
}

/** One page of suppliers, by name, with what they offer. */
export async function supplierPage(q: string, page: number) {
  const where = searchWhere(q);
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
