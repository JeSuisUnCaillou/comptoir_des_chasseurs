"use client";

import { useActionState } from "react";
import { settleAll, type TransactionState } from "@/app/[boutique]/achat-vente/actions";
import { septims } from "@/lib/pricing";

/** "Mettre 22 septims en caisse", "Sortir 3 septims de la caisse"…: what the net asks of the member. */
function netAction(net: number) {
  if (net > 0) return `mettre ${septims(net)} en caisse`;
  if (net < 0) return `sortir ${septims(-net)} de la caisse`;
  return "rien à mettre ni à sortir de la caisse";
}

/** The confirmation: what goes in, what comes out, and the one move that does both. */
function question(lines: number, deposit: number, take: number) {
  const net = deposit - take;
  const parts = [`Tout régler d'un coup : ${lines} ligne${lines > 1 ? "s" : ""}.`, ""];
  if (deposit > 0) parts.push(`À mettre en caisse : ${septims(deposit)}`);
  if (take > 0) parts.push(`À sortir de la caisse : ${septims(take)}`);
  parts.push("", net === 0 ? "Au total, rien à mettre ni à sortir." : `Au total, ${netAction(net)}.`);
  parts.push("C'est fait dans le jeu ? Toutes ces lignes compteront dans la caisse.");
  return parts.join("\n");
}

/**
 * Settles every line the member still has waiting for the till in one click:
 * shows the net to put in or take out, asks, then marks them all done.
 */
export function SettleAllButton({ lines, deposit, take }: { lines: number; deposit: number; take: number }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(settleAll, null);
  const net = deposit - take;
  return (
    <form action={action} className="settle-all">
      <input type="hidden" name="net" value={net} />
      <button
        className="btn btn-primary"
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!window.confirm(question(lines, deposit, take))) e.preventDefault();
        }}
      >
        Tout régler : {netAction(net)}
      </button>
      {state && !state.ok && (
        <span className="small minus" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
