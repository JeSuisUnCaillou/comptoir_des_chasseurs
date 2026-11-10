"use client";

import { ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { recordCashMovement, type TransactionState } from "@/app/(comptoir)/achat-vente/actions";
import { keepValues } from "@/lib/keep-values";
import { septims } from "@/lib/pricing";

const REASONS = ["Salaires", "Apport du gérant", "Retrait du gérant", "Correction de caisse"];

/** Money in or out of the till alone, with a preview of the till after it. */
export function CashMovementForm({ balance }: { balance: number }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(recordCashMovement, null);
  const [kind, setKind] = useState<"entree" | "sortie" | "">("");
  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const after = kind && amount !== "" && Number.isInteger(value) && value > 0
    ? balance + (kind === "entree" ? value : -value)
    : null;

  return (
    <form onSubmit={keepValues(action)}>
      <fieldset className="direction">
        <legend>Sens</legend>
        <label className={kind === "entree" ? "checked" : undefined}>
          <input
            type="radio"
            name="kind"
            value="entree"
            required
            checked={kind === "entree"}
            onChange={() => setKind("entree")}
          />
          <ArrowDownToLine size={20} /> Entrée d&apos;argent
        </label>
        <label className={kind === "sortie" ? "checked" : undefined}>
          <input
            type="radio"
            name="kind"
            value="sortie"
            checked={kind === "sortie"}
            onChange={() => setKind("sortie")}
          />
          <ArrowUpFromLine size={20} /> Sortie d&apos;argent
        </label>
      </fieldset>
      <div className="tx-grid">
        <div className="field">
          <label htmlFor="c-amount">Montant (septims)</label>
          <input
            id="c-amount"
            name="amount"
            type="number"
            min={1}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="c-label">Motif</label>
          <input id="c-label" name="label" required maxLength={100} list="c-reasons" placeholder="Salaires, apport…" />
          <datalist id="c-reasons">
            {REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
        <div className="field full">
          <label htmlFor="c-counterparty">Pour / de la part de (facultatif)</label>
          <input id="c-counterparty" name="counterparty" maxLength={100} />
        </div>
        <div className="field full">
          <label htmlFor="c-notes">Notes (facultatif)</label>
          <textarea id="c-notes" name="notes" rows={3} maxLength={500} />
        </div>
      </div>
      <p className="small muted" data-testid="apercu-caisse">
        Caisse actuelle : {septims(balance)}
        {after != null && (
          <>
            {" "}
            → après : <strong className={after >= 0 ? "plus" : "minus"}>{septims(after)}</strong>
          </>
        )}
      </p>
      {state && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        <Plus size={16} /> Inscrire le mouvement
      </button>
    </form>
  );
}
