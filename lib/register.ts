import "server-only";
import { and, count, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/lib/db";
import type { TransactionKind } from "@/lib/db/schema";

export type RegisterFilter = { kinds?: TransactionKind[]; from?: Date; to?: Date };

const canceller = alias(schema.members, "canceller");

function conditions(filter: RegisterFilter) {
  const t = schema.transactions;
  const where: SQL[] = [];
  if (filter.kinds?.length) where.push(inArray(t.kind, filter.kinds));
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

export type Till = { sales: number; buybacks: number; inflows: number; outflows: number; balance: number };

type TillSums = Omit<Till, "balance">;

function till({ sales, buybacks, inflows, outflows }: TillSums): Till {
  return { sales, buybacks, inflows, outflows, balance: sales + inflows - buybacks - outflows };
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

/** Money in and out of the till, ignoring cancelled lines. */
export async function tillTotals(filter: RegisterFilter = {}): Promise<Till> {
  const t = schema.transactions;
  const [row] = await getDb()
    .select(tillColumns("all"))
    .from(t)
    .where(and(isNull(t.cancelledAt), ...conditions(filter)));
  return tillFrom(row, "all");
}

/** The till today, over the last 7 days and since the opening, in one query. */
export async function tillSummary(now = new Date()) {
  const t = schema.transactions;
  const today = parisToday(now);
  const [row] = await getDb()
    .select({
      ...tillColumns("day", parisDay(today)!),
      ...tillColumns("week", parisDay(today, -6)!),
      ...tillColumns("all"),
    })
    .from(t)
    .where(isNull(t.cancelledAt));
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

/** Today's date in Paris, as "YYYY-MM-DD". */
export function parisToday(now = new Date()) {
  return parisDate.format(now);
}
