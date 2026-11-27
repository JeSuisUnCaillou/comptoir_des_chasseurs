import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { byName, getDb, schema, type Tx } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { activeIn } from "@/lib/products";

/** Delivered contracts per page of the Contrats page. */
export const DELIVERED_PAGE_SIZE = 12;

export type ContractValues = { name: string; client: string; dueOn: string | null };

/** The lines of these contracts, with their merchandise's name, unit and stock now, by name. */
async function linesOf(contractIds: number[]) {
  if (contractIds.length === 0) return new Map<number, ContractLine[]>();
  const l = schema.contractLines;
  const p = schema.products;
  const rows = await getDb()
    .select({
      id: l.id,
      contractId: l.contractId,
      productId: l.productId,
      quantity: l.quantity,
      productName: p.name,
      unit: p.unit,
      stock: p.stock,
    })
    .from(l)
    .innerJoin(p, eq(p.id, l.productId))
    .where(inArray(l.contractId, contractIds))
    .orderBy(byName(p.name), asc(l.id));
  const byContract = new Map<number, ContractLine[]>();
  for (const { contractId, ...line } of rows) {
    byContract.set(contractId, [...(byContract.get(contractId) ?? []), line]);
  }
  return byContract;
}

export type ContractLine = {
  id: number;
  productId: number;
  quantity: number;
  productName: string;
  unit: string;
  stock: number;
};

const contractFields = {
  id: schema.contracts.id,
  name: schema.contracts.name,
  client: schema.contracts.client,
  dueOn: schema.contracts.dueOn,
  createdAt: schema.contracts.createdAt,
  deliveredAt: schema.contracts.deliveredAt,
};

async function withLines(contracts: Omit<ContractWithLines, "lines">[]): Promise<ContractWithLines[]> {
  const lines = await linesOf(contracts.map((c) => c.id));
  return contracts.map((c) => ({ ...c, lines: lines.get(c.id) ?? [] }));
}

export type ContractWithLines = {
  id: number;
  name: string;
  client: string;
  dueOn: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  lines: ContractLine[];
};

/**
 * The shop's open contracts with their lines: those due soonest first, then
 * those without a day, newest first.
 */
export async function openContracts(shopId: number) {
  const c = schema.contracts;
  const rows = await getDb()
    .select(contractFields)
    .from(c)
    .where(and(eq(c.shopId, shopId), isNull(c.deliveredAt)))
    .orderBy(sql`${c.dueOn} asc nulls last`, desc(c.createdAt), desc(c.id));
  return withLines(rows);
}

/** A page of the shop's delivered contracts, latest delivered first, and how many there are. */
export async function deliveredContracts(shopId: number, page: number) {
  const c = schema.contracts;
  const delivered = and(eq(c.shopId, shopId), isNotNull(c.deliveredAt));
  const [rows, [{ total }]] = await Promise.all([
    getDb()
      .select(contractFields)
      .from(c)
      .where(delivered)
      .orderBy(desc(c.deliveredAt), desc(c.id))
      .limit(DELIVERED_PAGE_SIZE)
      .offset((page - 1) * DELIVERED_PAGE_SIZE),
    getDb().select({ total: count() }).from(c).where(delivered),
  ]);
  return { contracts: await withLines(rows), total };
}

/** A contract of the shop with its lines, or undefined. */
export async function contractOf(shopId: number, id: number) {
  const c = schema.contracts;
  const [row] = await getDb()
    .select(contractFields)
    .from(c)
    .where(and(eq(c.id, id), eq(c.shopId, shopId)));
  if (!row) return undefined;
  const [contract] = await withLines([row]);
  return contract;
}

/** A contract asks only for active merchandises of its shop: refuses any other. */
async function assertActive(db: Tx | ReturnType<typeof getDb>, shopId: number, ids: number[]) {
  if (ids.length === 0) return;
  const known = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(and(inArray(schema.products.id, ids), activeIn(shopId)));
  if (known.length !== new Set(ids).size) throw new UserError("Marchandise inconnue.");
}

/**
 * Writes a new contract of the shop with the merchandises it asks for, all at
 * once: each must be an active merchandise of the shop, asked once. Returns its id.
 */
export async function createContract(
  member: { id: number; shopId: number },
  values: ContractValues,
  lines: { productId: number; quantity: number }[],
) {
  const ids = lines.map((l) => l.productId);
  if (new Set(ids).size !== ids.length) throw new UserError("Une marchandise est demandée deux fois.");
  return getDb().transaction(async (tx) => {
    await assertActive(tx, member.shopId, ids);
    const [created] = await tx
      .insert(schema.contracts)
      .values({ ...values, shopId: member.shopId, memberId: member.id })
      .returning({ id: schema.contracts.id });
    if (lines.length > 0) {
      await tx.insert(schema.contractLines).values(lines.map((l) => ({ ...l, contractId: created.id })));
    }
    return created.id;
  });
}

/** Changes the name, client and day of a contract of the shop. */
export async function saveContract(shopId: number, id: number, values: ContractValues) {
  const c = schema.contracts;
  const [updated] = await getDb()
    .update(c)
    .set(values)
    .where(and(eq(c.id, id), eq(c.shopId, shopId)))
    .returning({ id: c.id });
  if (!updated) throw new UserError("Ce contrat n'existe plus.");
}

/** Asks `quantity` of a merchandise of the shop in a contract of the shop; a merchandise already asked gets the new quantity. */
export async function saveContractLine(
  shopId: number,
  { contractId, productId, quantity }: { contractId: number; productId: number; quantity: number },
) {
  const db = getDb();
  const [contract] = await db
    .select({ id: schema.contracts.id })
    .from(schema.contracts)
    .where(and(eq(schema.contracts.id, contractId), eq(schema.contracts.shopId, shopId)));
  if (!contract) throw new UserError("Ce contrat n'existe plus.");
  await assertActive(db, shopId, [productId]);
  await db
    .insert(schema.contractLines)
    .values({ contractId, productId, quantity })
    .onConflictDoUpdate({
      target: [schema.contractLines.contractId, schema.contractLines.productId],
      set: { quantity },
    });
}

/** The ids of the shop's contracts, for a write that names a contract line. */
function contractsOfShop(shopId: number) {
  return getDb().select({ id: schema.contracts.id }).from(schema.contracts).where(eq(schema.contracts.shopId, shopId));
}

/** Takes a merchandise off a contract of the shop. */
export async function removeContractLine(shopId: number, contractId: number, lineId: number) {
  const l = schema.contractLines;
  await getDb()
    .delete(l)
    .where(and(eq(l.id, lineId), eq(l.contractId, contractId), inArray(l.contractId, contractsOfShop(shopId))));
}

/** Marks a contract of the shop delivered, or opens it again. Its stock does not move. */
export async function setDelivered(shopId: number, id: number, delivered: boolean) {
  const c = schema.contracts;
  await getDb()
    .update(c)
    .set({ deliveredAt: delivered ? new Date() : null })
    .where(and(eq(c.id, id), eq(c.shopId, shopId)));
}

/** Deletes a contract of the shop; its lines go with it (on delete cascade). */
export async function deleteContract(shopId: number, id: number) {
  const c = schema.contracts;
  await getDb()
    .delete(c)
    .where(and(eq(c.id, id), eq(c.shopId, shopId)));
}
