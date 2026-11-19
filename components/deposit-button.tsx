"use client";

import { useActionState } from "react";
import { depositStock, type TransactionState } from "@/app/[boutique]/achat-vente/actions";

/** Says the merchandise of a purchase is now in the chest: its reminder goes. */
export function DepositButton({ id, what }: { id: number; what: string }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(depositStock, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small" type="submit" disabled={pending} aria-label={`C'est déposé : ${what}`}>
        C&apos;est déposé
      </button>
      {state && !state.ok && (
        <span className="small minus" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
