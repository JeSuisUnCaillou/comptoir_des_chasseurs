"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { createAndStock, type CreateState } from "@/app/[boutique]/inventaire/actions";
import type { ProductCategory } from "@/lib/db/schema";
import { CATEGORY_LABELS } from "@/lib/pricing";
import { keepValues } from "@/components/keep-values";
import { ProductPriceFields } from "@/components/product-price-fields";

/**
 * Brings a merchandise that does not exist yet into stock: creates it, then
 * records its entry. `canSetPrices` (a gérant) offers « Ajouter des prix » to
 * set its prices at once. `onCreated` gets its name once saved.
 */
export function NewStockProductForm({
  name,
  category: initialCategory,
  canSetPrices,
  onCreated,
  onCancel,
}: {
  name: string;
  category: ProductCategory | "";
  canSetPrices: boolean;
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [category, setCategory] = useState<ProductCategory>(initialCategory || "ressource");
  const [withPrices, setWithPrices] = useState(false);
  const [state, action, pending] = useActionState<CreateState, FormData>(createAndStock, null);
  useEffect(() => {
    if (state?.ok) onCreated(state.name);
  }, [state, onCreated]);

  return (
    <form onSubmit={keepValues(action)} className="new-product" aria-label="Nouvelle marchandise">
      <h3>Nouvelle marchandise</h3>
      <p className="small muted">
        {canSetPrices
          ? "Tu peux fixer ses prix tout de suite avec « Ajouter des prix », ou plus tard dans « Gérer les marchandises »."
          : "Elle n'aura pas de prix au début : un gérant pourra les fixer dans « Gérer les marchandises »."}
      </p>
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor={`${id}-n`}>Nom</label>
          <input id={`${id}-n`} name="name" required maxLength={100} defaultValue={name} autoFocus />
        </div>
        <div className="field">
          <label htmlFor={`${id}-c`}>Catégorie</label>
          <select
            id={`${id}-c`}
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
          >
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
          <label htmlFor={`${id}-q`}>Quantité ajoutée</label>
          <input id={`${id}-q`} name="quantity" type="number" min={1} required />
        </div>
        <div className="field span-2">
          <label htmlFor={`${id}-r`}>Motif</label>
          <input id={`${id}-r`} name="reason" required maxLength={200} placeholder="ex. chasse du matin" />
        </div>
      </div>
      {canSetPrices && (
        <label className="check">
          <input
            type="checkbox"
            name="withPrices"
            checked={withPrices}
            onChange={(e) => setWithPrices(e.target.checked)}
          />{" "}
          Ajouter des prix
        </label>
      )}
      {withPrices && <ProductPriceFields id={id} category={category} />}
      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <div className="move-actions" style={{ marginTop: 12 }}>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          Créer et ajouter au stock
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
