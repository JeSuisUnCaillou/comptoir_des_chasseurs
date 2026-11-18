"use client";

import { useActionState } from "react";
import { cancelTransaction, restoreTransaction, type TransactionState } from "@/app/[boutique]/achat-vente/actions";

/**
 * Cancels a register line, or counts a cancelled one again (`restore`); with
 * `whole`, every line of its entry at once. Asks `question` first.
 */
export function CancelButton({
  id,
  text,
  name,
  question,
  restore = false,
  whole = false,
}: {
  id: number;
  /** What the button says. */
  text: string;
  /** Its accessible name, saying which line or entry. */
  name: string;
  question: string;
  restore?: boolean;
  whole?: boolean;
}) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(
    restore ? restoreTransaction : cancelTransaction,
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
