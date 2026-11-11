import "server-only";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/lib/db";
import type { Product, TransactionKind } from "@/lib/db/schema";
import { sellTotal } from "@/lib/pricing";
import { entryKeyColumn, pendingEntryColumns } from "@/lib/register";

export type HandStock = {
  /** Units put in and taken out. */
  unitsIn: number;
  unitsOut: number;
  /** Goods put in minus goods taken out, at their sale price. */
  value: number;
  /** Movements left out because their merchandise has no sale price. */
  unpriced: number;
};

const priceColumns = {
  sellPrice: schema.products.sellPrice,
  sellQty: schema.products.sellQty,
  bulkMin: schema.products.bulkMin,
  bulkPrice: schema.products.bulkPrice,
  bulkQty: schema.products.bulkQty,
  buyPrice: schema.products.buyPrice,
  buyQty: schema.products.buyQty,
};

type PriceFields = Pick<Product, keyof typeof priceColumns>;
/** The product's prices through a left join: null when the line has no product. */
type JoinedPrices = { [K in keyof PriceFields]: PriceFields[K] | null };

/** What `quantity` units sell for at today's tariff, wholesale included; null without a sale price. */
function goodsValue(p: JoinedPrices, quantity: number) {
  const { buyQty, sellQty, bulkQty } = p;
  if (buyQty == null || sellQty == null || bulkQty == null) return null;
  return sellTotal({ ...p, buyQty, sellQty, bulkQty }, quantity)?.value ?? null;
}

/**
 * The stock a member moved by hand on the Inventaire between two instants
 * (hunts, transformations, losses…), without the movements of sales and
 * buybacks, and what it is worth at today's sale prices.
 */
export async function memberHandStock(memberId: number, from: Date, to: Date): Promise<HandStock> {
  const m = schema.stockMovements;
  const moves = await getDb()
    .select({ delta: m.delta, ...priceColumns })
    .from(m)
    .innerJoin(schema.products, eq(schema.products.id, m.productId))
    .where(and(eq(m.memberId, memberId), isNull(m.transactionId), gte(m.createdAt, from), lt(m.createdAt, to)));
  const result: HandStock = { unitsIn: 0, unitsOut: 0, value: 0, unpriced: 0 };
  for (const move of moves) {
    if (move.delta > 0) result.unitsIn += move.delta;
    else result.unitsOut -= move.delta;
    const value = goodsValue(move, Math.abs(move.delta));
    if (value == null) result.unpriced++;
    else result.value += Math.sign(move.delta) * value;
  }
  return result;
}

/**
 * One line of a member's activity: a register line (sale, buyback, cash
 * movement) or a stock movement made by hand on the Inventaire, which has no
 * money. The stock movements of register lines are left out: their line says it.
 */
export type ActivityLine = {
  source: "ligne" | "stock";
  id: number;
  /** The register line's kind, or "stock". */
  kind: TransactionKind | "stock";
  label: string;
  /** Units: positive for a register line, signed (+ in, − out) for a stock movement. */
  quantity: number;
  amount: number;
  /** Who paid or was paid, or the reason of a stock movement. */
  detail: string | null;
  notes: string | null;
  /** A sale or buyback whose septims are not in the till yet. */
  tillPending: boolean;
  /** The same for every line of one entry, null for a stock movement: see `entryKeyColumn`. */
  entryKey: string | null;
  /** What settling it settles with it: see `pendingEntryColumns`. */
  entryLines: number;
  entryTotal: number;
  entryItems: string;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelledBy: string | null;
};

const canceller = alias(schema.members, "canceller");

/** Both kinds of activity lines as one SQL source; columns come from the schema so tsc checks them. */
function activitySource(memberId: number, from: Date, to: Date) {
  const t = schema.transactions;
  const m = schema.stockMovements;
  const p = schema.products;
  const since = sql`${from.toISOString()}::timestamptz`;
  const until = sql`${to.toISOString()}::timestamptz`;
  const entry = pendingEntryColumns();
  return sql`
    select 'ligne' as source, ${t.id} as id, ${t.kind}::text as kind, ${t.label} as label,
      ${t.quantity} as quantity, ${t.amount} as amount, ${t.counterparty} as detail, ${t.notes} as notes,
      ${t.tillPending} as till_pending, ${t.createdAt} as created_at, ${t.cancelledAt} as cancelled_at, ${canceller.name} as cancelled_by,
      ${entry.entryLines} as entry_lines, ${entry.entryTotal} as entry_total, ${entry.entryItems} as entry_items,
      ${entryKeyColumn()} as entry_key
    from ${t}
    left join ${schema.members} ${canceller} on ${canceller.id} = ${t.cancelledBy}
    where ${t.memberId} = ${memberId} and ${t.createdAt} >= ${since} and ${t.createdAt} < ${until}
    union all
    select 'stock', ${m.id}, 'stock', ${p.name}, ${m.delta}, 0, ${m.reason}, null, false, ${m.createdAt}, null, null, 0, 0, '', null
    from ${m}
    join ${p} on ${p.id} = ${m.productId}
    where ${m.memberId} = ${memberId} and ${m.transactionId} is null
      and ${m.createdAt} >= ${since} and ${m.createdAt} < ${until}`;
}

/** A member's activity between two instants, newest first. */
export async function memberActivity(
  memberId: number,
  from: Date,
  to: Date,
  { limit, offset = 0 }: { limit: number; offset?: number },
): Promise<ActivityLine[]> {
  const rows = await getDb().execute<Record<string, unknown>>(sql`
    select * from (${activitySource(memberId, from, to)}) a
    order by created_at desc, source, id desc
    limit ${limit} offset ${offset}`);
  return rows.map((r) => ({
    source: r.source as ActivityLine["source"],
    id: Number(r.id),
    kind: r.kind as ActivityLine["kind"],
    label: String(r.label),
    quantity: Number(r.quantity),
    amount: Number(r.amount),
    detail: (r.detail as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    tillPending: r.till_pending === true,
    entryLines: Number(r.entry_lines),
    entryTotal: Number(r.entry_total),
    entryItems: String(r.entry_items ?? ""),
    entryKey: (r.entry_key as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    cancelledAt: r.cancelled_at ? new Date(r.cancelled_at as string) : null,
    cancelledBy: (r.cancelled_by as string | null) ?? null,
  }));
}

/** Number of lines of a member's activity between two instants. */
export async function memberActivityCount(memberId: number, from: Date, to: Date) {
  const [row] = await getDb().execute<{ total: number }>(
    sql`select count(*)::int as total from (${activitySource(memberId, from, to)}) a`,
  );
  return row.total;
}
