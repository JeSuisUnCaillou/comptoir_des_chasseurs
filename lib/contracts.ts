import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { byName, getDb, schema, type Tx } from "@/lib/db";
import type { ShopMember } from "@/lib/auth/session";
import { UserError } from "@/lib/errors";
import { canActOn } from "@/lib/policies";
import { splitPrice, unitPrice } from "@/lib/pricing";
import { activeIn } from "@/lib/products";
import { entryOf, sameEntryAs, settleEntry } from "@/lib/register";
import { cancelLines, recordLinesIn } from "@/lib/transactions";

/** Paid contracts per page of the Contrats page. */
export const PAID_PAGE_SIZE = 12;

export type ContractValues = { name: string; client: string; dueOn: string | null; price: number | null };

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

/** The sale that delivered a contract, if any. */
const delivery = alias(schema.transactions, "delivery");

/** Another line of the delivery's sale. */
const deliveryLine = alias(schema.transactions, "delivery_line");

/** Some line of the delivery's sale still counted, waiting for the till if `pending`. */
function deliveryLineLeft(pending: boolean) {
  return sql`exists (select 1 from ${schema.transactions} ${deliveryLine}
    where ${entryOf(deliveryLine)} = ${entryOf(delivery)} and ${deliveryLine.cancelledAt} is null
    ${pending ? sql`and ${deliveryLine.tillPending}` : sql``})`;
}

/**
 * Delivered: marked so and some line of its sale still counted (cancelling
 * that sale in the register undoes the delivery; cancelling one of its lines
 * does not). Paid: delivered, and no line of its sale waits for the till; a
 * contract delivered before prices has no sale and is paid.
 */
const deliveredSql = sql<boolean>`(${schema.contracts.deliveredAt} is not null and (${schema.contracts.deliveryLineId} is null or ${deliveryLineLeft(false)}))`;
const paidSql = sql<boolean>`(${deliveredSql} and (${schema.contracts.deliveryLineId} is null or not ${deliveryLineLeft(true)}))`;

const contractFields = {
  id: schema.contracts.id,
  name: schema.contracts.name,
  client: schema.contracts.client,
  dueOn: schema.contracts.dueOn,
  price: schema.contracts.price,
  memberId: schema.contracts.memberId,
  createdAt: schema.contracts.createdAt,
  deliveredAt: schema.contracts.deliveredAt,
  deliveryLineId: schema.contracts.deliveryLineId,
  delivered: deliveredSql,
  paid: paidSql,
};

function contracts() {
  return getDb()
    .select(contractFields)
    .from(schema.contracts)
    .leftJoin(delivery, eq(delivery.id, schema.contracts.deliveryLineId))
    .$dynamic();
}

async function withLines(contracts: Omit<ContractWithLines, "lines">[]): Promise<ContractWithLines[]> {
  const lines = await linesOf(contracts.map((c) => c.id));
  return contracts.map((c) => ({ ...c, lines: lines.get(c.id) ?? [] }));
}

export type ContractWithLines = {
  id: number;
  name: string;
  client: string;
  dueOn: string | null;
  price: number | null;
  /** Who wrote it: with the gérants, the one who may deliver it. */
  memberId: number;
  createdAt: Date;
  deliveredAt: Date | null;
  deliveryLineId: number | null;
  delivered: boolean;
  paid: boolean;
  lines: ContractLine[];
};

/**
 * The shop's contracts not delivered yet, with their lines: those due soonest
 * first, then those without a day, newest first.
 */
export async function openContracts(shopId: number) {
  const c = schema.contracts;
  const rows = await contracts()
    .where(and(eq(c.shopId, shopId), sql`not ${deliveredSql}`))
    .orderBy(sql`${c.dueOn} asc nulls last`, desc(c.createdAt), desc(c.id));
  return withLines(rows);
}

/** The shop's delivered contracts whose septims are still awaited, first delivered first. */
export async function unpaidContracts(shopId: number) {
  const c = schema.contracts;
  const rows = await contracts()
    .where(and(eq(c.shopId, shopId), deliveredSql, sql`not ${paidSql}`))
    .orderBy(asc(c.deliveredAt), asc(c.id));
  return withLines(rows);
}

/** A page of the shop's delivered and paid contracts, latest delivered first, and how many there are. */
export async function paidContracts(shopId: number, page: number) {
  const c = schema.contracts;
  const paid = and(eq(c.shopId, shopId), paidSql);
  const [rows, [{ total }]] = await Promise.all([
    contracts()
      .where(paid)
      .orderBy(desc(c.deliveredAt), desc(c.id))
      .limit(PAID_PAGE_SIZE)
      .offset((page - 1) * PAID_PAGE_SIZE),
    getDb()
      .select({ total: count() })
      .from(c)
      .leftJoin(delivery, eq(delivery.id, c.deliveryLineId))
      .where(paid),
  ]);
  return { contracts: await withLines(rows), total };
}

/** A contract of the shop with its lines, or undefined. */
export async function contractOf(shopId: number, id: number) {
  const c = schema.contracts;
  const [row] = await contracts().where(and(eq(c.id, id), eq(c.shopId, shopId)));
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

/**
 * Changes the name, client, day and price of a contract of the shop. A
 * delivered contract keeps its price: its sale was written at it.
 */
export async function saveContract(shopId: number, id: number, values: ContractValues) {
  const contract = await contractOf(shopId, id);
  if (!contract) throw new UserError("Ce contrat n'existe plus.");
  const { price, ...rest } = values;
  const c = schema.contracts;
  await getDb()
    .update(c)
    .set(contract.delivered ? rest : values)
    .where(and(eq(c.id, id), eq(c.shopId, shopId)));
}

/** Its merchandises change only before it is delivered: its sale was written with them. */
async function assertNotDelivered(shopId: number, contractId: number) {
  const contract = await contractOf(shopId, contractId);
  if (!contract) throw new UserError("Ce contrat n'existe plus.");
  if (contract.delivered) throw new UserError("Ce contrat est livré : ses marchandises ne changent plus.");
}

/** Asks `quantity` of a merchandise of the shop in a contract of the shop; a merchandise already asked gets the new quantity. */
export async function saveContractLine(
  shopId: number,
  { contractId, productId, quantity }: { contractId: number; productId: number; quantity: number },
) {
  const db = getDb();
  await assertNotDelivered(shopId, contractId);
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
  await assertNotDelivered(shopId, contractId);
  const l = schema.contractLines;
  await getDb()
    .delete(l)
    .where(and(eq(l.id, lineId), eq(l.contractId, contractId), inArray(l.contractId, contractsOfShop(shopId))));
}

type Actor = Pick<ShopMember, "id" | "role" | "shopId">;

/**
 * Delivers a contract of the shop: a sale of its merchandises to its client,
 * at its price shared among them (`splitPrice`), whose septims wait for the
 * till until the shop is paid. The stock goes out as with any sale. All of it
 * or nothing. Gérants, or the member who wrote it.
 */
export async function deliverContract(member: Actor, id: number) {
  await getDb().transaction(async (tx) => {
    const c = schema.contracts;
    // One delivery at a time: a second click waits, then finds it delivered.
    const [locked] = await tx
      .select({ id: c.id })
      .from(c)
      .where(and(eq(c.id, id), eq(c.shopId, member.shopId)))
      .for("update");
    if (!locked) throw new UserError("Ce contrat n'existe plus.");
    const [contract] = await tx
      .select(contractFields)
      .from(c)
      .leftJoin(delivery, eq(delivery.id, c.deliveryLineId))
      .where(eq(c.id, id));
    if (!canActOn(member, contract)) throw new UserError("Seuls les gérants et le créateur du contrat le livrent.");
    if (contract.delivered) throw new UserError("Ce contrat est déjà livré.");
    const p = schema.products;
    const lines = await tx
      .select({ productId: p.id, label: p.name, quantity: schema.contractLines.quantity, sellPrice: p.sellPrice, sellQty: p.sellQty })
      .from(schema.contractLines)
      .innerJoin(p, eq(p.id, schema.contractLines.productId))
      .where(eq(schema.contractLines.contractId, id))
      .orderBy(byName(p.name), asc(schema.contractLines.id));
    if (lines.length === 0) throw new UserError("Ce contrat ne demande aucune marchandise : rien à livrer.");
    const price = contract.price ?? 0;
    const amounts = splitPrice(
      price,
      lines.map((l) => ({ quantity: l.quantity, value: l.sellPrice == null ? null : (unitPrice(l.sellPrice, l.sellQty) ?? 0) * l.quantity })),
    );
    const [first] = await recordLinesIn(tx, member, {
      kind: "vente",
      counterparty: contract.client || null,
      notes: `Contrat « ${contract.name} »`,
      tillPending: price > 0,
      lines: lines.map((l, i) => ({ productId: l.productId, label: l.label, quantity: l.quantity, amount: amounts[i] })),
    });
    await tx.update(c).set({ deliveredAt: new Date(), deliveryLineId: first }).where(eq(c.id, id));
    await tx.update(schema.transactions).set({ contractId: id }).where(sameEntryAs(first));
  });
}

/** The septims of a delivered contract of the shop are in: its sale counts in the till. */
export async function receivePayment(member: Actor, id: number) {
  const contract = await contractOf(member.shopId, id);
  if (!contract) throw new UserError("Ce contrat n'existe plus.");
  if (!contract.delivered || contract.deliveryLineId == null) throw new UserError("Ce contrat n'est pas encore livré.");
  if (contract.paid) throw new UserError("L'argent de ce contrat est déjà en caisse.");
  // Its whole sale, even when its first line was cancelled alone in the register.
  await settleEntry(member.shopId, contract.deliveryLineId);
}

/**
 * Undoes the delivery of a contract of the shop: its sale is cancelled (its
 * merchandises go back into the stock) and it is open again.
 */
export async function cancelDelivery(member: Actor, id: number) {
  const contract = await contractOf(member.shopId, id);
  if (!contract) throw new UserError("Ce contrat n'existe plus.");
  if (contract.delivered && contract.deliveryLineId != null) await cancelLines(member, contract.deliveryLineId, true);
  const c = schema.contracts;
  await getDb()
    .update(c)
    .set({ deliveredAt: null, deliveryLineId: null })
    .where(and(eq(c.id, id), eq(c.shopId, member.shopId)));
}

/** Deletes a contract of the shop; its lines go with it (on delete cascade). */
export async function deleteContract(shopId: number, id: number) {
  const c = schema.contracts;
  await getDb()
    .delete(c)
    .where(and(eq(c.id, id), eq(c.shopId, shopId)));
}
