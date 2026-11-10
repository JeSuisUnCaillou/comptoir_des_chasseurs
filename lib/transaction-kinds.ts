import type { TransactionKind } from "@/lib/db/schema";

/** Lines that move money alone, with no merchandise. */
export const CASH_KINDS = ["entree", "sortie"] as const satisfies readonly TransactionKind[];

export function isCashKind(kind: TransactionKind) {
  return (CASH_KINDS as readonly TransactionKind[]).includes(kind);
}

/** What a line does to the till: + when money comes in, − when it goes out. */
export function signedAmount(kind: TransactionKind, amount: number) {
  return kind === "vente" || kind === "entree" ? amount : -amount;
}
