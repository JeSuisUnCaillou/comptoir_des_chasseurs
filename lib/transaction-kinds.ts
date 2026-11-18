import type { TransactionKind } from "@/lib/db/schema";
import { PAGE_SIZE } from "@/lib/pagination";

/** Most merchandises one sale or purchase may carry: one register page, so the confirmation shows them all. */
export const MAX_LINES = PAGE_SIZE;

/** Lines that move money alone, with no merchandise. */
export const CASH_KINDS = ["entree", "sortie"] as const satisfies readonly TransactionKind[];

export function isCashKind(kind: TransactionKind) {
  return (CASH_KINDS as readonly TransactionKind[]).includes(kind);
}

/** Who the other side of a line is, as its label says it (the cash movement form asks "Pour / de la part de"). */
export function counterpartyLabel(kind: TransactionKind) {
  return kind === "vente" ? "Client" : kind === "rachat" ? "Vendeur" : "Pour / de la part de";
}

/** What a line does to the till: + when money comes in, − when it goes out. */
export function signedAmount(kind: TransactionKind, amount: number) {
  return kind === "vente" || kind === "entree" ? amount : -amount;
}

/**
 * The cash movement that brings the till from `balance` to the septims
 * counted in the coffer; null when they already match.
 */
export function gapToCount(balance: number, counted: number): { kind: "entree" | "sortie"; amount: number } | null {
  const gap = counted - balance;
  if (gap === 0) return null;
  return { kind: gap > 0 ? "entree" : "sortie", amount: Math.abs(gap) };
}

/** A refusal about line `i` of an entry of `count` lines: it names the line when there are several. */
export function lineMessage(count: number, i: number, message: string) {
  return count > 1 ? `Marchandise ${i + 1} : ${message}` : message;
}

/** The merchandise picker's choice for an article written under its own label, outside the stock. */
export const OTHER_ARTICLE = "autre";

/** The purchase's choice for a merchandise the shop does not know yet: created, then bought into stock. */
export const NEW_MERCHANDISE = "nouvelle";
