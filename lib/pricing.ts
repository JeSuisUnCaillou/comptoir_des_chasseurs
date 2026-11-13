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

/** `privileged`: the seller's privileged group's name, when its own price applied. */
export type Rate = { price: number; qty: number; bulk: boolean; privileged: string | null };

/** A privileged group's buyback price, for the product's buyQty units. */
export type PrivilegedRate = { name: string; price: number };

/**
 * The rate a sale or a buyback of `quantity` units is priced at, or null
 * without a tariff: wholesale from its threshold on a sale, the seller's
 * privileged group's own price on a buyback when it has one.
 */
export function appliedRate(
  p: Prices,
  kind: "vente" | "rachat",
  quantity: number,
  { privileged = null }: { privileged?: PrivilegedRate | null } = {},
): Rate | null {
  if (kind === "vente") {
    if (isBulk(p, quantity)) return { price: p.bulkPrice!, qty: p.bulkQty, bulk: true, privileged: null };
    return p.sellPrice == null ? null : { price: p.sellPrice, qty: p.sellQty, bulk: false, privileged: null };
  }
  if (privileged) return { price: privileged.price, qty: p.buyQty, bulk: false, privileged: privileged.name };
  return p.buyPrice == null ? null : { price: p.buyPrice, qty: p.buyQty, bulk: false, privileged: null };
}

/** What the shop pays a seller. */
export function buyTotal(
  p: Prices,
  quantity: number,
  { privileged = null }: { privileged?: PrivilegedRate | null } = {},
): Total | null {
  const r = appliedRate(p, "rachat", quantity, { privileged });
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

/** A price for `qty` units brought to one unit, to compare prices set for different lots. */
export function unitPrice(price: number | null, qty: number) {
  return price == null ? null : price / qty;
}

/** Gross margin per unit over the reference quantity, to compare products sold in different lots. */
export function unitMargin(p: Prices) {
  const ref = referenceQuantity(p);
  const gross = margin(p, ref);
  return gross == null ? null : gross / ref;
}

/** Leather made from one hide, to compare transformations. */
export function leatherPerHide(p: Hide) {
  return p.hidesPerBatch && p.leatherPerBatch ? p.leatherPerBatch / p.hidesPerBatch : null;
}

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

/** French plural of a unit: pièce → pièces, peau → peaux, lot → lots. */
export function plural(unit: string, n: number) {
  if (Math.abs(n) < 2 || /[sxz]$/.test(unit)) return unit;
  if (/(au|eau|eu)$/.test(unit)) return `${unit}x`;
  return `${unit}s`;
}
