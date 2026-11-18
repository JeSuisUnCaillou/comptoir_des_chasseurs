import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, lt, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/lib/db";
import type { TransactionKind } from "@/lib/db/schema";
import { daysBetween, parisToday } from "@/lib/dates";
import { lastWeekEnd } from "@/lib/week-ends";

export type RegisterFilter = {
  kinds?: TransactionKind[];
  from?: Date;
  to?: Date;
  memberId?: number;
  /** Only the lines waiting for the till. */
  tillPending?: boolean;
};

const canceller = alias(schema.members, "canceller");
const sameEntry = alias(schema.transactions, "same_entry");

type EntryColumns = Record<"shopId" | "memberId" | "kind" | "createdAt" | "tillPending" | "cancelledAt", AnyColumn>;

/**
 * What makes lines one entry: `recordLines` (lib/transactions.ts) writes them in one database
 * transaction, so they share their shop, their author, their kind and their
 * instant (now() is the start of the transaction). The instant stays in SQL, which
 * keeps its microseconds. Settling, saying what settling settles and showing
 * an entry as one block all read it from here.
 */
function entryOf(rows: EntryColumns) {
  return sql`(${rows.shopId}, ${rows.memberId}, ${rows.kind}, ${rows.createdAt})`;
}

/** The lines of `rows` still waiting for the till in the entry `line` (an `entryOf`). */
function pendingOfSameEntry(rows: EntryColumns, line: SQL) {
  return sql`${entryOf(rows)} = ${line} and ${rows.tillPending} and ${rows.cancelledAt} is null`;
}

/** The same text for every line of one entry, to show them together. */
export function entryKeyColumn() {
  return sql<string>`${entryOf(schema.transactions)}::text`;
}

/**
 * For a line waiting for the till, what `settleEntry` would settle with it:
 * the number of lines of its entry still waiting, their total, and one
 * "quantity × label" per line. Correlated on the outer `transactions` row, so
 * the confirmation can say what one click settles.
 */
export function pendingEntryColumns() {
  const t = schema.transactions;
  const s = sameEntry;
  const from = sql`from ${schema.transactions} ${s}
    where ${pendingOfSameEntry(s, entryOf(t))}`;
  const pending = sql`${t.tillPending} and ${t.cancelledAt} is null`;
  return {
    entryLines: sql<number>`case when ${pending} then (select count(*)::int ${from}) else 0 end`,
    pendingTotal: sql<number>`case when ${pending} then (select coalesce(sum(${s.amount}), 0)::int ${from}) else 0 end`,
    entryItems: sql<string>`case when ${pending} then (select string_agg(${s.quantity} || ' × ' || ${s.label}, E'\n' order by ${s.id}) ${from}) else '' end`,
  };
}

/**
 * For a line of an entry of several lines, the septims of the whole entry, its
 * cancelled lines left out, whatever page its lines fall on; null for a line
 * alone, or when every line is cancelled. Unsigned, like `amount`.
 */
export function entrySumColumn() {
  const t = schema.transactions;
  const s = sameEntry;
  return sql<number | null>`(select case when count(*) > 1 and count(*) filter (where ${s.cancelledAt} is null) > 0
      then (sum(${s.amount}) filter (where ${s.cancelledAt} is null))::int end
    from ${schema.transactions} ${s} where ${entryOf(s)} = ${entryOf(t)})`;
}

/** Every line of the entry holding line `id` (see `entryOf`). */
export function sameEntryAs(id: number) {
  const t = schema.transactions;
  const s = sameEntry;
  return sql`${entryOf(t)} = (select ${s.shopId}, ${s.memberId}, ${s.kind}, ${s.createdAt}
    from ${schema.transactions} ${s} where ${s.id} = ${id})`;
}

/**
 * For each line, its whole entry, whatever page its lines fall on: one
 * "quantity × label" per line still counted and per line cancelled, so one
 * click can cancel or restore them all and its confirmation can say which.
 */
export function entryStateColumns() {
  const t = schema.transactions;
  const s = sameEntry;
  const from = sql`from ${schema.transactions} ${s} where ${entryOf(s)} = ${entryOf(t)}`;
  const items = (cancelled: boolean) =>
    sql<string>`coalesce((select string_agg(${s.quantity} || ' × ' || ${s.label}, E'\n' order by ${s.id}) ${from}
      and ${s.cancelledAt} is ${cancelled ? sql`not null` : sql`null`}), '')`;
  return {
    entryActiveItems: items(false),
    entryCancelledItems: items(true),
  };
}

/** The shop's lines matching the filter. */
function conditions(shopId: number, filter: RegisterFilter) {
  const t = schema.transactions;
  const where: SQL[] = [eq(t.shopId, shopId)];
  if (filter.kinds?.length) where.push(inArray(t.kind, filter.kinds));
  if (filter.from) where.push(gte(t.createdAt, filter.from));
  if (filter.to) where.push(lt(t.createdAt, filter.to));
  if (filter.memberId) where.push(eq(t.memberId, filter.memberId));
  if (filter.tillPending) where.push(eq(t.tillPending, true));
  return where;
}

/**
 * What the line's stock movements moved (their sum) and how many there are,
 * read by `cancelStockDelta`.
 */
function stockMovedColumns() {
  const m = schema.stockMovements;
  const t = schema.transactions;
  const of = sql`from ${m} where ${m.transactionId} = ${t.id} and ${m.productId} = ${t.productId}`;
  return {
    stockMoved: sql<number>`(select coalesce(sum(${m.delta}), 0)::int ${of})`,
    stockMoves: sql<number>`(select count(*)::int ${of})`,
  };
}

/**
 * What cancelling a line still counted does to the stock: it gives back what
 * the line holds. That is what its stock movements moved (`moved`, their sum:
 * a sale beyond the stock takes less than it sells), plus, for a line
 * imported from the old app, the movement it never wrote: its quantity.
 * A line written here starts with one movement, and each cancellation and
 * each restoration adds one, so a line still counted has an odd number of
 * them (`moves`) when written here, an even number when imported. Used by
 * `cancelLines` and by the confirmation that announces it.
 */
export function cancelStockDelta(kind: TransactionKind, quantity: number, moved: number, moves: number) {
  const unwritten = moves % 2 === 0 ? (kind === "vente" ? -quantity : quantity) : 0;
  return -(moved + unwritten);
}

export async function registerEntries(
  shopId: number,
  filter: RegisterFilter,
  { limit, offset = 0 }: { limit: number; offset?: number },
) {
  const t = schema.transactions;
  const where = conditions(shopId, filter);
  return getDb()
    .select({
      id: t.id,
      kind: t.kind,
      label: t.label,
      productId: t.productId,
      quantity: t.quantity,
      amount: t.amount,
      counterparty: t.counterparty,
      notes: t.notes,
      tillPending: t.tillPending,
      createdAt: t.createdAt,
      cancelledAt: t.cancelledAt,
      member: schema.members.name,
      memberId: t.memberId,
      cancelledBy: canceller.name,
      entryKey: entryKeyColumn(),
      entrySum: entrySumColumn(),
      ...stockMovedColumns(),
      ...pendingEntryColumns(),
      ...entryStateColumns(),
    })
    .from(t)
    .innerJoin(schema.members, eq(schema.members.id, t.memberId))
    .leftJoin(canceller, eq(canceller.id, t.cancelledBy))
    .where(and(...where))
    .orderBy(desc(t.createdAt), desc(t.id))
    .limit(limit)
    .offset(offset)
    .then((rows) =>
      rows.map(({ stockMoved, stockMoves, ...row }) => ({
        ...row,
        // Units cancelling the line puts back in stock (or takes out, for a buyback).
        stockBack:
          row.productId == null ? 0 : Math.abs(cancelStockDelta(row.kind, row.quantity, stockMoved, stockMoves)),
      })),
    );
}

export type RegisterEntry = Awaited<ReturnType<typeof registerEntries>>[number];

/** Number of lines (cancelled ones included) matching the filter. */
export async function registerCount(shopId: number, filter: RegisterFilter = {}) {
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.transactions)
    .where(and(...conditions(shopId, filter)));
  return row.total;
}

/**
 * The septims of the entry holding line `id` of the shop are now in the till,
 * or out of it: every line of that entry waiting for the till counts in it
 * from now on (see `pendingOfSameEntry`).
 */
export async function settleEntry(shopId: number, id: number) {
  const t = schema.transactions;
  const line = getDb()
    .select({ shopId: t.shopId, memberId: t.memberId, kind: t.kind, createdAt: t.createdAt })
    .from(t)
    .where(and(eq(t.id, id), eq(t.shopId, shopId)));
  await getDb()
    .update(t)
    .set({ tillPending: false })
    .where(pendingOfSameEntry(t, sql`(${line})`));
}

export type Till = {
  sales: number;
  buybacks: number;
  inflows: number;
  outflows: number;
  /** What the till holds: sales and inflows minus buybacks and outflows. */
  balance: number;
  /** Sales minus buybacks, cash movements left out. */
  margin: number;
};

/** Whether any money is written but waiting for the till (see pendingTotals). */
export function hasPending(waiting: Till) {
  return waiting.sales + waiting.inflows + waiting.buybacks + waiting.outflows > 0;
}

type TillSums = Omit<Till, "balance" | "margin">;

function till({ sales, buybacks, inflows, outflows }: TillSums): Till {
  return {
    sales,
    buybacks,
    inflows,
    outflows,
    balance: sales + inflows - buybacks - outflows,
    margin: sales - buybacks,
  };
}

const TILL_FIELDS: Record<keyof TillSums, TransactionKind> = {
  sales: "vente",
  buybacks: "rachat",
  inflows: "entree",
  outflows: "sortie",
};

/** Sum of the amounts of one kind, from a date when given. */
function sumOf(kind: TransactionKind, since?: Date) {
  const t = schema.transactions;
  return since
    ? sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = ${kind} and ${t.createdAt} >= ${since.toISOString()}::timestamptz), 0)::int`
    : sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = ${kind}), 0)::int`;
}

function tillColumns<P extends string>(prefix: P, since?: Date) {
  return Object.fromEntries(
    Object.entries(TILL_FIELDS).map(([field, kind]) => [`${prefix}_${field}`, sumOf(kind, since)]),
  ) as Record<`${P}_${keyof TillSums}`, SQL<number>>;
}

function tillFrom<P extends string>(row: Record<string, number>, prefix: P): Till {
  const pick = (field: keyof TillSums) => row[`${prefix}_${field}`];
  return till({ sales: pick("sales"), buybacks: pick("buybacks"), inflows: pick("inflows"), outflows: pick("outflows") });
}

/** Lines not cancelled, whose money is in the till, or still waiting for it when `pending`. */
function live(pending = false) {
  const t = schema.transactions;
  return [isNull(t.cancelledAt), eq(t.tillPending, pending)];
}

/** Money in and out of the till, ignoring cancelled lines and those waiting for the till. */
export async function tillTotals(shopId: number, filter: RegisterFilter = {}): Promise<Till> {
  return totalsOf(shopId, filter, false);
}

/** The money of the lines waiting for the till: not counted in it yet. */
export async function pendingTotals(shopId: number, filter: RegisterFilter = {}): Promise<Till> {
  return totalsOf(shopId, filter, true);
}

async function totalsOf(shopId: number, filter: RegisterFilter, pending: boolean) {
  const t = schema.transactions;
  const [row] = await getDb()
    .select(tillColumns("all"))
    .from(t)
    .where(and(...live(pending), ...conditions(shopId, filter)));
  return tillFrom(row, "all");
}

/**
 * The shop's till since the latest declared end of the week (`week`, the
 * whole register before the first) and since the opening (`all`), with that
 * end of the week. `days` and `allDays` say for how many calendar days in
 * Paris each counts: 0 from today, null before the first end of the week or
 * the first line.
 */
export async function tillSummary(shopId: number, now = new Date()) {
  const t = schema.transactions;
  const weekEnd = await lastWeekEnd(shopId);
  const [{ first, ...sums }] = await getDb()
    .select({
      ...tillColumns("week", weekEnd?.declaredAt),
      ...tillColumns("all"),
      first: sql<Date | null>`min(${t.createdAt})`.mapWith(t.createdAt),
    })
    .from(t)
    .where(and(eq(t.shopId, shopId), ...live()));
  const daysSince = (from: Date | null | undefined) =>
    from ? daysBetween(parisToday(from), parisToday(now)) : null;
  return {
    week: tillFrom(sums, "week"),
    all: tillFrom(sums, "all"),
    weekEnd,
    days: daysSince(weekEnd?.declaredAt),
    allDays: daysSince(first),
  };
}
