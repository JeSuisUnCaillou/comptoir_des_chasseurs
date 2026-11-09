import "server-only";
import { and, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
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

export async function registerEntries(filter: RegisterFilter = {}, limit = 200) {
  const t = schema.transactions;
  const where = conditions(filter);
  return getDb()
    .select({
      id: t.id,
      kind: t.kind,
      label: t.label,
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
    .limit(limit);
}

/** Money in and out of the till, ignoring cancelled lines. */
export async function tillTotals(filter: RegisterFilter = {}) {
  const t = schema.transactions;
  const [row] = await getDb()
    .select({
      sales: sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = 'vente'), 0)::int`,
      buybacks: sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = 'rachat'), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(t)
    .where(and(isNull(t.cancelledAt), ...conditions(filter)));
  return { ...row, balance: row.sales - row.buybacks };
}

/** Midnight in Keizaal's time zone (Europe/Paris) for a "YYYY-MM-DD" date. */
export function parisDay(value: string | undefined, offsetDays = 0): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const utc = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(utc.getTime())) return undefined;
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  // Paris is UTC+1 or UTC+2: find which by formatting that instant there.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(utc),
  );
  return new Date(utc.getTime() - hour * 3600_000);
}

/** Today's date in Paris, as "YYYY-MM-DD". */
export function parisToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

export type RegisterEntry = Awaited<ReturnType<typeof registerEntries>>[number];
