"use client";

import { useActionState } from "react";
import { settleTransaction, type TransactionState } from "@/app/(comptoir)/achat-vente/actions";

/** Says the septims of a line waiting for the till are now in it (a sale) or out of it (a buyback). */
export function SettleButton({ id, sale }: { id: number; sale: boolean }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(settleTransaction, null);
  const what = sale ? `la vente n°${id}` : `l'achat n°${id}`;
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <button
        className="btn btn-small"
        type="submit"
        disabled={pending}
        aria-label={sale ? `Septims de ${what} déposés dans la caisse` : `Septims de ${what} pris dans la caisse`}
        onClick={(e) => {
          const question = sale
            ? `Les septims de ${what} sont-ils déposés dans la caisse ?`
            : `Les septims de ${what} sont-ils pris dans la caisse ?`;
          if (!window.confirm(question)) e.preventDefault();
        }}
      >
        {sale ? "Septims déposés" : "Septims pris"}
      </button>
      {state && !state.ok && (
        <span className="small minus" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
