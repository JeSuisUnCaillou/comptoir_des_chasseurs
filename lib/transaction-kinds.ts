import type { TransactionKind } from "@/lib/db/schema";
import { PAGE_SIZE } from "@/lib/pagination";

/** Most merchandises one sale or purchase may carry: one register page, so the confirmation shows them all. */
export const MAX_LINES = PAGE_SIZE;

/** Lines that move money alone, with no merchandise. */
export const CASH_KINDS = ["entree", "sortie"] as const satisfies readonly TransactionKind[];

export function isCashKind(kind: TransactionKind) {
  return (CASH_KINDS as readonly TransactionKind[]).includes(kind);
}

/** What a line does to the till: + when money comes in, − when it goes out. */
export function signedAmount(kind: TransactionKind, amount: number) {
  return kind === "vente" || kind === "entree" ? amount : -amount;
}
