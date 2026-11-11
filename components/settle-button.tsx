"use client";

import { useActionState } from "react";
import { settleTransaction, type TransactionState } from "@/app/(comptoir)/achat-vente/actions";
import { septims } from "@/lib/pricing";

/** The lines a click settles together: those of one entry, see `pendingEntryColumns`. */
export type PendingEntry = { entryLines: number; entryTotal: number; entryItems: string };

/** What the confirmation asks: one line, or every line of the entry with their total. */
export function settleQuestion(id: number, sale: boolean, entry: PendingEntry) {
  const verb = sale ? "déposés dans" : "pris dans";
  if (entry.entryLines <= 1) {
    return `Les septims de ${sale ? `la vente n°${id}` : `l'achat n°${id}`} sont-ils ${verb} la caisse ?`;
  }
  const items = entry.entryItems
    .split("\n")
    .map((item) => `• ${item}`)
    .join("\n");
  return (
    `Les septims de ${sale ? "cette vente" : "cet achat"} sont-ils ${verb} la caisse ?\n\n` +
    `Cela vaut pour ses ${entry.entryLines} lignes, ${septims(entry.entryTotal)} en tout :\n${items}`
  );
}

/**
 * Says the septims of an entry waiting for the till are now in it (a sale) or
 * out of it (a buyback): one button per entry, showing its total.
 */
export function SettleButton({ id, sale, entry }: { id: number; sale: boolean; entry: PendingEntry }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(settleTransaction, null);
  const total = entry.entryTotal;
  const done = `${sale ? "déposé" : "pris"}${sale && total >= 2 ? "s" : ""}`;
  const what =
    entry.entryLines > 1
      ? `${sale ? "cette vente" : "cet achat"} de ${entry.entryLines} lignes`
      : sale
        ? `la vente n°${id}`
        : `l'achat n°${id}`;
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <button
        className="btn btn-small"
        type="submit"
        disabled={pending}
        aria-label={`${septims(total)} de ${what} ${done} dans la caisse`}
        onClick={(e) => {
          if (!window.confirm(settleQuestion(id, sale, entry))) e.preventDefault();
        }}
      >
        {septims(total)} {done}
      </button>
      {state && !state.ok && (
        <span className="small minus" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
