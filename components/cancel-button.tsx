"use client";

import { useActionState } from "react";
import { cancelTransaction, restoreTransaction, type TransactionState } from "@/app/[boutique]/achat-vente/actions";
import { cancelStockMovement, restoreStockMovement } from "@/app/[boutique]/inventaire/actions";

/**
 * Cancels a register line, or counts a cancelled one again (`restore`); with
 * `whole`, every line of its entry at once; with `stock`, a stock movement
 * made by hand instead. Asks `question` first.
 */
export function CancelButton({
  id,
  text,
  name,
  question,
  restore = false,
  whole = false,
  stock = false,
}: {
  id: number;
  /** What the button says. */
  text: string;
  /** Its accessible name, saying which line or entry. */
  name: string;
  question: string;
  restore?: boolean;
  whole?: boolean;
  stock?: boolean;
}) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(
    stock ? (restore ? restoreStockMovement : cancelStockMovement) : restore ? restoreTransaction : cancelTransaction,
    null,
  );
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      {whole && <input type="hidden" name="entier" value="1" />}
      <button
        className="btn btn-small btn-ghost"
        type="submit"
        disabled={pending}
        aria-label={name}
        onClick={(e) => {
          if (!window.confirm(question)) e.preventDefault();
        }}
      >
        {text}
      </button>
      {state && !state.ok && (
        <span className="small minus" role="alert">
          {state.message}
        </span>
      )}
    </form>
  );
}
