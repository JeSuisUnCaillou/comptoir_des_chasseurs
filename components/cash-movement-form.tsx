"use client";

import { ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { recordCashMovement, type TransactionState } from "@/app/[boutique]/achat-vente/actions";
import { keepValues } from "@/components/keep-values";
import { septims } from "@/lib/pricing";
import { gapToCount, signedAmount } from "@/lib/transaction-kinds";

const COUNT_REASON = "Correction de caisse";
const REASONS = ["Salaires", "Apport du gérant", "Retrait du gérant", COUNT_REASON];

/**
 * Money in or out of the till alone, with a preview of the till after it.
 * « J'ai compté » turns what is in the coffer into the movement that brings
 * the till to it.
 */
export function CashMovementForm({ balance }: { balance: number }) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(recordCashMovement, null);
  const [counted, setCounted] = useState("");
  const [kind, setKind] = useState<"entree" | "sortie" | "">("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [tillPending, setTillPending] = useState(false);
  const value = Number(amount);
  const countedValue = Number(counted);
  const countMatches = counted !== "" && Number.isInteger(countedValue) && countedValue === balance;

  function count(text: string) {
    setCounted(text);
    const total = Number(text);
    if (text === "" || !Number.isInteger(total) || total < 0) return;
    const gap = gapToCount(balance, total);
    setKind(gap?.kind ?? "");
    setAmount(gap ? String(gap.amount) : "");
    setTillPending(false);
    if (label === "") setLabel(COUNT_REASON);
  }
  // Changed by hand, the movement no longer says what was counted.
  const byHand = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setCounted("");
  };
  // Septims not yet in the till, or not yet out of it, leave it as it is.
  const after = !tillPending && kind && amount !== "" && Number.isInteger(value) && value > 0
    ? balance + signedAmount(kind, value)
    : null;

  return (
    <form onSubmit={keepValues(action)}>
      <div className="field">
        <label htmlFor="c-counted">J&apos;ai compté dans le coffre (septims, facultatif)</label>
        <input
          id="c-counted"
          type="number"
          min={0}
          step={1}
          value={counted}
          onChange={(e) => count(e.target.value)}
          aria-describedby="c-counted-help"
        />
        <span id="c-counted-help" className="small muted">
          {countMatches
            ? "La caisse est juste : rien à inscrire."
            : "Le sens et le montant de l'écart avec la caisse se remplissent seuls."}
        </span>
      </div>
      <fieldset className="direction">
        <legend>Sens</legend>
        <label className={kind === "entree" ? "checked" : undefined}>
          <input
            type="radio"
            name="kind"
            value="entree"
            required
            checked={kind === "entree"}
            onChange={() => byHand(setKind)("entree")}
          />
          <ArrowDownToLine size={20} /> Entrée d&apos;argent
        </label>
        <label className={kind === "sortie" ? "checked" : undefined}>
          <input
            type="radio"
            name="kind"
            value="sortie"
            checked={kind === "sortie"}
            onChange={() => byHand(setKind)("sortie")}
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
            onChange={(e) => byHand(setAmount)(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="c-label">Motif</label>
          <input
            id="c-label"
            name="label"
            required
            maxLength={100}
            list="c-reasons"
            placeholder="Salaires, apport…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
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
        <div className="field full">
          <label className="check">
            <input
              type="checkbox"
              name="tillPending"
              checked={tillPending}
              onChange={(e) => byHand(setTillPending)(e.target.checked)}
            />{" "}
            {kind === "sortie" ? "Pas encore sorti de la caisse" : "Pas encore mis en caisse"}
          </label>
          <span className="small muted">Tu pourras le valider plus tard depuis le registre.</span>
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
        {tillPending && " (inchangée tant que l'argent n'est pas en caisse)"}
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
