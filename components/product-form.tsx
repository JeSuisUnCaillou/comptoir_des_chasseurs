"use client";

import { useActionState, useState } from "react";
import { saveProduct, type ProductFormState } from "@/app/(comptoir)/marchandises/actions";
import type { Product, ProductCategory } from "@/lib/db/schema";
import { CATEGORY_LABELS } from "@/lib/pricing";
import { keepValues } from "@/components/keep-values";

function NumberField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: number | null;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      <input
        id={`f-${name}`}
        name={name}
        type="number"
        min={0}
        step={1}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
      />
    </div>
  );
}

/** `fromTarifs`: the form was opened from the Tarifs page, which saving goes back to. */
export function ProductForm({ product, fromTarifs = false }: { product?: Product; fromTarifs?: boolean }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, null);
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "ressource");

  return (
    <form onSubmit={keepValues(action)}>
      {product && <input type="hidden" name="id" value={product.id} />}
      {fromTarifs && <input type="hidden" name="depuis" value="tarifs" />}
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="f-name">Nom</label>
          <input id="f-name" name="name" required maxLength={100} defaultValue={product?.name} />
        </div>
        <div className="field">
          <label htmlFor="f-category">Catégorie</label>
          <select
            id="f-category"
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
          <label htmlFor="f-unit">Unité (au singulier)</label>
          <input id="f-unit" name="unit" maxLength={30} defaultValue={product?.unit ?? "pièce"} />
        </div>
      </div>

      <h3>Achat (on paie)</h3>
      <div className="form-grid">
        <NumberField name="buyPrice" label="Prix en septims" defaultValue={product?.buyPrice} placeholder="Laisser vide si on n'en achète pas" />
        <NumberField name="buyQty" label="Pour (unités)" defaultValue={product?.buyQty ?? 1} />
        <NumberField
          name="citizenBuyPrice"
          label="Prix pour les citoyens d'Estemarche"
          defaultValue={product?.citizenBuyPrice}
          placeholder="Laisser vide si c'est le même prix"
        />
      </div>

      <h3>Vente (on encaisse)</h3>
      <div className="form-grid">
        <NumberField name="sellPrice" label="Prix en septims" defaultValue={product?.sellPrice} placeholder="Laisser vide si on n'en vend pas" />
        <NumberField name="sellQty" label="Pour (unités)" defaultValue={product?.sellQty ?? 1} />
      </div>

      <h3>Vente en gros (facultatif)</h3>
      <div className="form-grid">
        <NumberField name="bulkMin" label="À partir de (unités)" defaultValue={product?.bulkMin} />
        <NumberField name="bulkPrice" label="Prix en septims" defaultValue={product?.bulkPrice} />
        <NumberField name="bulkQty" label="Pour (unités)" defaultValue={product?.bulkQty ?? 1} />
      </div>

      {category === "peau" && (
        <>
          <h3>Transformation en cuir</h3>
          <div className="form-grid">
            <NumberField name="hidesPerBatch" label="Peaux par lot" defaultValue={product?.hidesPerBatch} />
            <NumberField name="leatherPerBatch" label="Cuirs obtenus" defaultValue={product?.leatherPerBatch} />
          </div>
        </>
      )}

      {product && (
        <label className="check">
          <input type="checkbox" name="archived" defaultChecked={product.archived} /> Ne plus utiliser (cachée
          des tarifs et de l&apos;inventaire)
        </label>
      )}

      {state?.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending} style={{ marginTop: 18 }}>
        {product ? "Enregistrer la marchandise" : "Ajouter la marchandise"}
      </button>
    </form>
  );
}
