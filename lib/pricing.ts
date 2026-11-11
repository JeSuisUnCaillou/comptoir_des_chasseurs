import type { Product } from "@/lib/db/schema";

type Prices = Pick<
  Product,
  "buyPrice" | "buyQty" | "sellPrice" | "sellQty" | "bulkMin" | "bulkPrice" | "bulkQty"
>;

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function formatNumber(n: number) {
  return number.format(n);
}

/** "1 septim", "12 septims", "+4 septims". */
export function septims(n: number, { signed = false } = {}) {
  const sign = signed && n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return `${sign}${formatNumber(abs)} septim${abs >= 2 ? "s" : ""}`;
}

/** "2 septims / unité", "1 septim / 4 unités". */
export function rate(price: number, qty: number) {
  return `${septims(price)} / ${qty === 1 ? "unité" : `${formatNumber(qty)} unités`}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number) {
  return (a * b) / gcd(a, b);
}

export type Total = { value: number; complete: boolean };

function total(price: number, per: number, quantity: number): Total {
  return { value: (quantity * price) / per, complete: quantity % per === 0 };
}

export function isBulk(p: Prices, quantity: number) {
  return p.bulkMin != null && p.bulkPrice != null && quantity >= p.bulkMin;
}

export type Rate = { price: number; qty: number; bulk: boolean; citizen: boolean };

/**
 * The rate a sale or a buyback of `quantity` units is priced at, or null
 * without a tariff: wholesale from its threshold on a sale, the citizens of
 * Estemarche's own price on a buyback when it is set.
 */
export function appliedRate(
  p: Prices & Partial<Pick<Product, "citizenBuyPrice">>,
  kind: "vente" | "rachat",
  quantity: number,
  { citizen = false } = {},
): Rate | null {
  if (kind === "vente") {
    if (isBulk(p, quantity)) return { price: p.bulkPrice!, qty: p.bulkQty, bulk: true, citizen: false };
    return p.sellPrice == null ? null : { price: p.sellPrice, qty: p.sellQty, bulk: false, citizen: false };
  }
  if (citizen && p.citizenBuyPrice != null) {
    return { price: p.citizenBuyPrice, qty: p.buyQty, bulk: false, citizen: true };
  }
  return p.buyPrice == null ? null : { price: p.buyPrice, qty: p.buyQty, bulk: false, citizen: false };
}

/** What the comptoir pays a seller. */
export function buyTotal(
  p: Prices & Partial<Pick<Product, "citizenBuyPrice">>,
  quantity: number,
  { citizen = false } = {},
): Total | null {
  const r = appliedRate(p, "rachat", quantity, { citizen });
  return r && total(r.price, r.qty, quantity);
}

export function sellTotal(p: Prices, quantity: number): (Total & { bulk: boolean }) | null {
  const r = appliedRate(p, "vente", quantity);
  return r && { ...total(r.price, r.qty, quantity), bulk: r.bulk };
}

/** The smallest quantity that makes whole lots on both sides, or the wholesale threshold. */
export function referenceQuantity(p: Prices) {
  if (p.bulkMin != null && p.bulkPrice != null) return p.bulkMin;
  return lcm(p.buyQty, p.sellQty);
}

/** Gross margin when buying then reselling `quantity` units. */
export function margin(p: Prices, quantity: number) {
  const buy = buyTotal(p, quantity);
  const sell = sellTotal(p, quantity);
  if (!buy || !sell) return null;
  return sell.value - buy.value;
}

type Hide = Pick<Product, "buyPrice" | "hidesPerBatch" | "leatherPerBatch">;

/** Margin of one batch of hides turned into leather and sold to the blacksmith. */
export function batchMargin(p: Hide, blacksmithPrice: number) {
  if (p.buyPrice == null || !p.hidesPerBatch || !p.leatherPerBatch) return null;
  return p.leatherPerBatch * blacksmithPrice - p.hidesPerBatch * p.buyPrice;
}

export function transformation(p: Hide, hides: number) {
  if (!p.hidesPerBatch || !p.leatherPerBatch) return null;
  const batches = Math.floor(hides / p.hidesPerBatch);
  return {
    batches,
    leather: batches * p.leatherPerBatch,
    remaining: hides - batches * p.hidesPerBatch,
  };
}

export const CATEGORY_LABELS = {
  peau: "Peaux",
  cuir: "Cuirs",
  viande: "Viandes et venaison",
  ressource: "Ressources",
  autre: "Autres marchandises",
} as const;

/** French plural of a unit: pièce → pièces, peau → peaux, lot → lots. */
export function plural(unit: string, n: number) {
  if (Math.abs(n) < 2 || /[sxz]$/.test(unit)) return unit;
  if (/(au|eau|eu)$/.test(unit)) return `${unit}x`;
  return `${unit}s`;
}
