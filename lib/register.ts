import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { byName, getDb, schema } from "@/lib/db";
import type { TransactionKind } from "@/lib/db/schema";

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
 * What makes lines one entry: `recordTransaction` writes them in one database
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
    entryTotal: sql<number>`case when ${pending} then (select coalesce(sum(${s.amount}), 0)::int ${from}) else 0 end`,
    entryItems: sql<string>`case when ${pending} then (select string_agg(${s.quantity} || ' × ' || ${s.label}, E'\n' order by ${s.id}) ${from}) else '' end`,
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
      ...pendingEntryColumns(),
    })
    .from(t)
    .innerJoin(schema.members, eq(schema.members.id, t.memberId))
    .leftJoin(canceller, eq(canceller.id, t.cancelledBy))
    .where(and(...where))
    .orderBy(desc(t.createdAt), desc(t.id))
    .limit(limit)
    .offset(offset);
}

/** Every member of the shop, deactivated ones included, for the "Employé" filters. */
export async function memberNames(shopId: number) {
  const m = schema.members;
  return getDb()
    .select({ id: m.id, name: m.name })
    .from(m)
    .innerJoin(schema.shopMembers, eq(schema.shopMembers.memberId, m.id))
    .where(eq(schema.shopMembers.shopId, shopId))
    .orderBy(byName(m.name), asc(m.id));
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

/** The shop's till today, over the last 7 days and since the opening, in one query. */
export async function tillSummary(shopId: number, now = new Date()) {
  const t = schema.transactions;
  const today = parisToday(now);
  const [row] = await getDb()
    .select({
      ...tillColumns("day", parisDay(today)!),
      ...tillColumns("week", parisDay(today, -6)!),
      ...tillColumns("all"),
    })
    .from(t)
    .where(and(eq(t.shopId, shopId), ...live()));
  return { day: tillFrom(row, "day"), week: tillFrom(row, "week"), all: tillFrom(row, "all") };
}

const parisHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  hourCycle: "h23",
});
const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Midnight in Keizaal's time zone (Europe/Paris) for a "YYYY-MM-DD" date. */
export function parisDay(value: string | undefined, offsetDays = 0): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const utc = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(utc.getTime())) return undefined;
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  // Paris is UTC+1 or UTC+2: find which by formatting that instant there.
  return new Date(utc.getTime() - Number(parisHour.format(utc)) * 3600_000);
}

/**
 * The "du" and "au" dates of a filter, from the query string ("YYYY-MM-DD",
 * anything else ignored), and the instants they stand for in Paris: from
 * midnight on "du" to midnight after "au", which is included. A reversed
 * range is put back in order.
 */
export function dayRange(duParam: string | undefined, auParam: string | undefined) {
  let du = duParam && parisDay(duParam) ? duParam : undefined;
  let au = auParam && parisDay(auParam) ? auParam : undefined;
  if (du && au && du > au) [du, au] = [au, du];
  return { du, au, from: parisDay(du), to: parisDay(au, 1) };
}

/**
 * Like `dayRange`, but a period of `days` days ending today when nothing is
 * asked: a lone "au" gets the `days` days ending on it, a lone "du" runs to today.
 */
export function lastDays(duParam: string | undefined, auParam: string | undefined, days: number, now = new Date()) {
  const asked = dayRange(duParam, auParam);
  const au = asked.au ?? parisToday(now);
  const du = asked.du ?? parisToday(parisDay(au, 1 - days)!);
  return { ...dayRange(du, au), asked };
}

/** Today's date in Paris, as "YYYY-MM-DD". */
export function parisToday(now = new Date()) {
  return parisDate.format(now);
}
