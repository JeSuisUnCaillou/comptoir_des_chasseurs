import "server-only";
import { and, count, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/lib/db";
import type { TransactionKind } from "@/lib/db/schema";

export type RegisterFilter = { kind?: TransactionKind; from?: Date; to?: Date };

const canceller = alias(schema.members, "canceller");

function conditions(filter: RegisterFilter) {
  const t = schema.transactions;
  const where: SQL[] = [];
  if (filter.kind) where.push(eq(t.kind, filter.kind));
  if (filter.from) where.push(gte(t.createdAt, filter.from));
  if (filter.to) where.push(lt(t.createdAt, filter.to));
  return where;
}

export async function registerEntries(
  filter: RegisterFilter = {},
  { limit, offset = 0 }: { limit: number; offset?: number },
) {
  const t = schema.transactions;
  const where = conditions(filter);
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
      createdAt: t.createdAt,
      cancelledAt: t.cancelledAt,
      member: schema.members.name,
      memberId: t.memberId,
      cancelledBy: canceller.name,
    })
    .from(t)
    .innerJoin(schema.members, eq(schema.members.id, t.memberId))
    .leftJoin(canceller, eq(canceller.id, t.cancelledBy))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(t.createdAt), desc(t.id))
    .limit(limit)
    .offset(offset);
}

export type RegisterEntry = Awaited<ReturnType<typeof registerEntries>>[number];

/** Number of lines (cancelled ones included) matching the filter. */
export async function registerCount(filter: RegisterFilter = {}) {
  const where = conditions(filter);
  const [row] = await getDb()
    .select({ total: count() })
    .from(schema.transactions)
    .where(where.length ? and(...where) : undefined);
  return row.total;
}

export type Till = { sales: number; buybacks: number; balance: number };

function till(sales: number, buybacks: number): Till {
  return { sales, buybacks, balance: sales - buybacks };
}

/** Money in and out of the till, ignoring cancelled lines. */
export async function tillTotals(filter: RegisterFilter = {}): Promise<Till> {
  const t = schema.transactions;
  const [row] = await getDb()
    .select({
      sales: sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = 'vente'), 0)::int`,
      buybacks: sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = 'rachat'), 0)::int`,
    })
    .from(t)
    .where(and(isNull(t.cancelledAt), ...conditions(filter)));
  return till(row.sales, row.buybacks);
}

/** The till today, over the last 7 days and since the opening, in one query. */
export async function tillSummary(now = new Date()) {
  const t = schema.transactions;
  const today = parisToday(now);
  const day = parisDay(today)!;
  const week = parisDay(today, -6)!;
  const sum = (kind: TransactionKind, since?: Date) =>
    since
      ? sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = ${kind} and ${t.createdAt} >= ${since.toISOString()}::timestamptz), 0)::int`
      : sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = ${kind}), 0)::int`;
  const [row] = await getDb()
    .select({
      daySales: sum("vente", day),
      dayBuybacks: sum("rachat", day),
      weekSales: sum("vente", week),
      weekBuybacks: sum("rachat", week),
      sales: sum("vente"),
      buybacks: sum("rachat"),
    })
    .from(t)
    .where(isNull(t.cancelledAt));
  return {
    day: till(row.daySales, row.dayBuybacks),
    week: till(row.weekSales, row.weekBuybacks),
    all: till(row.sales, row.buybacks),
  };
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

/** Today's date in Paris, as "YYYY-MM-DD". */
export function parisToday(now = new Date()) {
  return parisDate.format(now);
}
