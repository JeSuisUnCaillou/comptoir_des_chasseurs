import "server-only";
import { and, eq, gte, isNull, lt, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Product } from "@/lib/db/schema";
import { sellTotal } from "@/lib/pricing";
import { signedAmount } from "@/lib/transaction-kinds";

export type Contribution = {
  /** Goods put in (+) or taken out (−) by hand on the Inventaire, at their sale price. */
  stock: number;
  /** For each buyback: what the goods will sell for, minus what was paid. */
  buybacks: number;
  /** For each sale: what was cashed, minus the goods at their sale price. */
  sales: number;
  /** Money in and out of the till without goods. */
  cash: number;
  total: number;
  /** Lines and movements left out because their merchandise has no sale price. */
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
 * Estimates what a member brought to the comptoir between two instants: how
 * much richer the comptoir got, counting its stock at today's sale prices,
 * through what the member did. Cancelled lines, and the stock movements of
 * register lines (counted with their line), are left out of the inventory part.
 */
export async function memberContribution(memberId: number, from: Date, to: Date): Promise<Contribution> {
  const t = schema.transactions;
  const m = schema.stockMovements;
  const p = schema.products;
  const lineWhere: SQL[] = [eq(t.memberId, memberId), isNull(t.cancelledAt), gte(t.createdAt, from), lt(t.createdAt, to)];
  const moveWhere: SQL[] = [eq(m.memberId, memberId), isNull(m.transactionId), gte(m.createdAt, from), lt(m.createdAt, to)];
  const [lines, moves] = await Promise.all([
    getDb()
      .select({ kind: t.kind, productId: t.productId, quantity: t.quantity, amount: t.amount, ...priceColumns })
      .from(t)
      .leftJoin(p, eq(p.id, t.productId))
      .where(and(...lineWhere)),
    getDb()
      .select({ delta: m.delta, ...priceColumns })
      .from(m)
      .innerJoin(p, eq(p.id, m.productId))
      .where(and(...moveWhere)),
  ]);

  const c: Contribution = { stock: 0, buybacks: 0, sales: 0, cash: 0, total: 0, unpriced: 0 };
  for (const move of moves) {
    const value = goodsValue(move, Math.abs(move.delta));
    if (value == null) c.unpriced++;
    else c.stock += Math.sign(move.delta) * value;
  }
  for (const line of lines) {
    const money = signedAmount(line.kind, line.amount);
    if (line.kind === "entree" || line.kind === "sortie") {
      c.cash += money;
      continue;
    }
    // An article outside the stock only moves money.
    let goods = 0;
    if (line.productId != null) {
      const value = goodsValue(line, line.quantity);
      if (value == null) {
        c.unpriced++;
        continue;
      }
      goods = line.kind === "vente" ? -value : value;
    }
    if (line.kind === "vente") c.sales += money + goods;
    else c.buybacks += money + goods;
  }
  c.total = c.stock + c.buybacks + c.sales + c.cash;
  return c;
}
