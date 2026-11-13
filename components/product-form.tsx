"use client";

import { useActionState, useState } from "react";
import { saveProduct, type ProductFormState } from "@/app/[boutique]/marchandises/actions";
import type { Product, ProductCategory } from "@/lib/db/schema";
import { CATEGORY_LABELS } from "@/lib/pricing";
import { keepValues } from "@/components/keep-values";
import { ProductPriceFields, type GroupChoice } from "@/components/product-price-fields";

/** `fromTarifs`: the form was opened from the Tarifs page, which saving goes back to. */
export function ProductForm({
  product,
  groups,
  fromTarifs = false,
}: {
  product?: Product & { privileged: { groupId: number; price: number }[] };
  /** The shop's privileged groups, a price field each. */
  groups: GroupChoice[];
  fromTarifs?: boolean;
}) {
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

      <ProductPriceFields id="f" category={category} product={product} groups={groups} />

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
