"use client";

import { useActionState } from "react";
import { settleTransaction, type TransactionState } from "@/app/[boutique]/achat-vente/actions";
import type { TransactionKind } from "@/lib/db/schema";
import { septims } from "@/lib/pricing";
import { signedAmount } from "@/lib/transaction-kinds";

/** The lines a click settles together: those of one entry, see `pendingEntryColumns`. */
export type PendingEntry = { entryLines: number; entryTotal: number; entryItems: string };

/** "la vente n°12", "cet achat de 3 lignes"…: what one click settles. */
function entryName(id: number, kind: TransactionKind, lines: number) {
  if (lines > 1) {
    return kind === "vente" ? "cette vente" : kind === "rachat" ? "cet achat" : "cette écriture";
  }
  return kind === "vente" ? `la vente n°${id}` : kind === "rachat" ? `l'achat n°${id}` : `le mouvement de caisse n°${id}`;
}

/** "de la vente n°12", "du mouvement de caisse n°4"… */
function ofEntry(name: string) {
  return name.startsWith("le ") ? `du ${name.slice(3)}` : `de ${name}`;
}

/** What the confirmation asks: one line, or every line of the entry with their total. */
export function settleQuestion(id: number, kind: TransactionKind, entry: PendingEntry) {
  const amount = `${entry.entryTotal >= 2 ? "les " : ""}${septims(entry.entryTotal)}`;
  const done = `${signedAmount(kind, 1) > 0 ? "mis" : "pris"} ${amount}`;
  const of = ofEntry(entryName(id, kind, entry.entryLines));
  if (entry.entryLines <= 1) return `Tu as bien ${done} ${of} dans la caisse ?`;
  const items = entry.entryItems
    .split("\n")
    .map((item) => `• ${item}`)
    .join("\n");
  return `Tu as bien ${done} ${of} (${entry.entryLines} lignes) dans la caisse ?\n\n${items}`;
}

/**
 * Says the septims of an entry waiting for the till are now in it (a sale, money
 * in) or out of it (a buyback, money out): one button per entry, showing its total.
 */
export function SettleButton({ id, kind, entry }: { id: number; kind: TransactionKind; entry: PendingEntry }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(settleTransaction, null);
  const total = entry.entryTotal;
  const amount = `${total >= 2 ? "les " : ""}${septims(total)}`;
  const into = signedAmount(kind, 1) > 0;
  const name = entryName(id, kind, entry.entryLines);
  const what = entry.entryLines > 1 ? `${name} de ${entry.entryLines} lignes` : name;
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <button
        className="btn btn-small"
        type="submit"
        disabled={pending}
        aria-label={`${into ? "Mettre en caisse" : "Sortir de la caisse"} ${amount} ${ofEntry(what)}`}
        onClick={(e) => {
          if (!window.confirm(settleQuestion(id, kind, entry))) e.preventDefault();
        }}
      >
        {into ? `Mettre ${septims(total)} en caisse` : `Sortir ${septims(total)} de la caisse`}
      </button>
      {state && !state.ok && (
        <span className="small minus" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
