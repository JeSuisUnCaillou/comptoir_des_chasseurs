"use client";

import { useActionState, useEffect, useId } from "react";
import { createAndStock, type CreateState } from "@/app/(comptoir)/inventaire/actions";
import type { ProductCategory } from "@/lib/db/schema";
import { CATEGORY_LABELS } from "@/lib/pricing";
import { keepValues } from "@/lib/keep-values";

/**
 * Brings a merchandise that does not exist yet into stock: creates it without
 * prices, then records its entry. `onCreated` gets its name once saved.
 */
export function NewStockProductForm({
  name,
  category,
  onCreated,
  onCancel,
}: {
  name: string;
  category: ProductCategory | "";
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [state, action, pending] = useActionState<CreateState, FormData>(createAndStock, null);
  useEffect(() => {
    if (state?.ok) onCreated(state.name);
  }, [state, onCreated]);

  return (
    <form onSubmit={keepValues(action)} className="new-product" aria-label="Nouvelle marchandise">
      <h3>Nouvelle marchandise</h3>
      <p className="small muted">
        Elle est créée sans prix, avec son entrée en stock ; un gérant règle ses prix dans Gérer les tarifs.
      </p>
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor={`${id}-n`}>Nom</label>
          <input id={`${id}-n`} name="name" required maxLength={100} defaultValue={name} autoFocus />
        </div>
        <div className="field">
          <label htmlFor={`${id}-c`}>Catégorie</label>
          <select id={`${id}-c`} name="category" defaultValue={category || "ressource"}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-u`}>Unité (au singulier)</label>
          <input id={`${id}-u`} name="unit" maxLength={30} defaultValue="pièce" />
        </div>
        <div className="field">
          <label htmlFor={`${id}-q`}>Quantité entrée</label>
          <input id={`${id}-q`} name="quantity" type="number" min={1} required />
        </div>
        <div className="field span-2">
          <label htmlFor={`${id}-r`}>Motif</label>
          <input id={`${id}-r`} name="reason" required maxLength={200} placeholder="ex. chasse du matin" />
        </div>
      </div>
      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <div className="move-actions" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          Créer et entrer en stock
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
