"use client";

import { useActionState } from "react";
import { cancelTransaction, type TransactionState } from "@/app/(comptoir)/registre/actions";

export function CancelButton({ id, label }: { id: number; label: string }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(cancelTransaction, null);
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <button
        className="btn btn-small btn-ghost"
        type="submit"
        disabled={pending}
        aria-label={`Annuler ${label}`}
        onClick={(e) => {
          if (!window.confirm(`Annuler « ${label} » ? Le stock sera rétabli.`)) e.preventDefault();
        }}
      >
        Annuler
      </button>
      {state && !state.ok && (
        <span className="small minus" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
