"use client";

import { useActionState, useState } from "react";
import { saveProduct, type ProductFormState } from "@/app/[boutique]/marchandises/actions";
import type { Product } from "@/lib/db/schema";
import { CategorySelect, defaultCategory, type CategoryChoice } from "@/components/category-select";
import { keepValues } from "@/components/keep-values";
import { ProductPriceFields, type GroupChoice } from "@/components/product-price-fields";

/** `fromTarifs`: the form was opened from the Tarifs page, which saving goes back to. */
export function ProductForm({
  product,
  groups,
  categories,
  fromTarifs = false,
}: {
  product?: Product & { privileged: { groupId: number; price: number }[] };
  /** The shop's privileged groups, a price field each. */
  groups: GroupChoice[];
  categories: CategoryChoice[];
  fromTarifs?: boolean;
}) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(saveProduct, null);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? defaultCategory(categories));
  const hides = categories.some((c) => c.id === categoryId && c.hides);

  return (
    <form onSubmit={keepValues(action)}>
      {product && <input type="hidden" name="id" value={product.id} />}
      {fromTarifs && <input type="hidden" name="depuis" value="tarifs" />}
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="f-name">Nom</label>
          <input id="f-name" name="name" required maxLength={100} defaultValue={product?.name} />
        </div>
        <CategorySelect id="f-category" categories={categories} value={categoryId} onChange={setCategoryId} />
        <div className="field">
          <label htmlFor="f-unit">Unité (au singulier)</label>
          <input id="f-unit" name="unit" maxLength={30} defaultValue={product?.unit ?? "pièce"} />
        </div>
      </div>

      <ProductPriceFields id="f" hides={hides} product={product} groups={groups} />

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
