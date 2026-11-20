"use client";

import { Save } from "lucide-react";
import { useActionState, useState } from "react";
import { editStockMovement, type MoveState } from "@/app/[boutique]/inventaire/actions";
import { formatNumber } from "@/lib/pricing";

type Line = { id: number; product: string; delta: number };

/**
 * The units of each movement still counted of a Mouvement de stock, to
 * change; each keeps its direction, and the stock follows.
 */
export function EditMovementForm({
  id,
  lines,
  back,
}: {
  id: number;
  lines: Line[];
  /** The page of the shop to come back to, the Inventaire when null. */
  back: string | null;
}) {
  const [state, action, pending] = useActionState<MoveState, FormData>(editStockMovement, null);
  const [quantities, setQuantities] = useState(() => lines.map((l) => String(Math.abs(l.delta))));
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {back && <input type="hidden" name="retour" value={back} />}
      <div className="tx-grid">
        {lines.map((line, i) => (
          <div className="field" key={line.id}>
            <label htmlFor={`q-${line.id}`}>
              {line.product} ({line.delta > 0 ? "entrée" : "sortie"})
            </label>
            <input type="hidden" name="lineId" value={line.id} />
            <input
              id={`q-${line.id}`}
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              value={quantities[i]}
              onChange={(e) => setQuantities((all) => all.map((q, j) => (j === i ? e.target.value : q)))}
            />
            {Number(quantities[i]) !== Math.abs(line.delta) && (
              <span className="small muted">Avant : {formatNumber(Math.abs(line.delta))}</span>
            )}
          </div>
        ))}
      </div>
      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        <Save size={16} /> Enregistrer les quantités
      </button>
    </form>
  );
}
