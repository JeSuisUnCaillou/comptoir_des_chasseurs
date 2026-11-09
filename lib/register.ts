import "server-only";
import { and, desc, eq, gte, isNull, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/lib/db";
import type { TransactionKind } from "@/lib/db/schema";

export type RegisterFilter = { kind?: TransactionKind; from?: Date; to?: Date };

const canceller = alias(schema.members, "canceller");

export async function registerEntries(filter: RegisterFilter = {}, limit = 200) {
  const t = schema.transactions;
  const where: SQL[] = [];
  if (filter.kind) where.push(eq(t.kind, filter.kind));
  if (filter.from) where.push(gte(t.createdAt, filter.from));
  if (filter.to) where.push(lt(t.createdAt, filter.to));
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
export async function tillTotals(since?: Date) {
  const t = schema.transactions;
  const [row] = await getDb()
    .select({
      sales: sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = 'vente'), 0)::int`,
      buybacks: sql<number>`coalesce(sum(${t.amount}) filter (where ${t.kind} = 'rachat'), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(t)
    .where(and(isNull(t.cancelledAt), since ? gte(t.createdAt, since) : undefined));
  return { ...row, balance: row.sales - row.buybacks };
}
