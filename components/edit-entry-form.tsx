"use client";

import { Save } from "lucide-react";
import { useActionState, useState } from "react";
import { editEntry, type TransactionState } from "@/app/[boutique]/achat-vente/actions";
import { formatNumber, septims } from "@/lib/pricing";
import { isCashKind, signedAmount } from "@/lib/transaction-kinds";
import type { TransactionKind } from "@/lib/db/schema";

type Line = { id: number; label: string; quantity: number; amount: number };

/**
 * The septims of each line still counted of an entry, to change; the stock
 * does not move. Shows the entry's new total as it is typed.
 */
export function EditEntryForm({ id, kind, lines }: { id: number; kind: TransactionKind; lines: Line[] }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(editEntry, null);
  const [amounts, setAmounts] = useState(() => lines.map((l) => String(l.amount)));
  const cash = isCashKind(kind);
  const total = amounts.reduce((sum, a) => sum + (Number(a) || 0), 0);
  const before = lines.reduce((sum, l) => sum + l.amount, 0);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <div className="tx-grid">
        {lines.map((line, i) => (
          <div className="field" key={line.id}>
            <label htmlFor={`m-${line.id}`}>
              {cash ? `${line.label} (septims)` : `${formatNumber(line.quantity)} × ${line.label} (septims)`}
            </label>
            <input type="hidden" name="lineId" value={line.id} />
            <input
              id={`m-${line.id}`}
              name="amount"
              type="number"
              inputMode="numeric"
              min={cash ? 1 : 0}
              step={1}
              required
              value={amounts[i]}
              onChange={(e) => setAmounts((all) => all.map((a, j) => (j === i ? e.target.value : a)))}
            />
            {Number(amounts[i]) !== line.amount && (
              <span className="small muted">Avant : {septims(line.amount)}</span>
            )}
          </div>
        ))}
      </div>
      {lines.length > 1 && (
        <p className="row-actions">
          <button
            className="btn btn-small btn-ghost"
            type="button"
            onClick={() => setAmounts(lines.map(() => "0"))}
          >
            Tout mettre à 0
          </button>
        </p>
      )}
      <p className="small muted" data-testid="nouveau-total">
        Total : {septims(signedAmount(kind, before), { signed: true })} → après :{" "}
        <strong>{septims(signedAmount(kind, total), { signed: true })}</strong>
      </p>
      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        <Save size={16} /> Enregistrer les montants
      </button>
    </form>
  );
}
