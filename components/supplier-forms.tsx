"use client";

import { useActionState } from "react";
import {
  deleteSupplier,
  saveOffer,
  saveSupplier,
  type SupplierFormState,
} from "@/app/[boutique]/fournisseurs/actions";
import type { Supplier } from "@/lib/db/schema";
import { keepValues } from "@/components/keep-values";
import { ProductField } from "@/components/product-field";

function Status({ state }: { state: SupplierFormState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "6px 0 0" }}>
      {state.message}
    </p>
  );
}

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const [state, action, pending] = useActionState<SupplierFormState, FormData>(saveSupplier, null);
  return (
    <form onSubmit={keepValues(action)}>
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="s-name">Nom</label>
          <input id="s-name" name="name" required maxLength={100} defaultValue={supplier?.name} />
        </div>
        <div className="field">
          <label htmlFor="s-place">Lieu</label>
          <input id="s-place" name="place" maxLength={100} defaultValue={supplier?.place} placeholder="ex. Vendeaume" />
        </div>
        <div className="field span-2">
          <label htmlFor="s-notes">Note</label>
          <input id="s-notes" name="notes" maxLength={300} defaultValue={supplier?.notes} placeholder="ex. Représentant des Guerriers-Nés" />
        </div>
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {supplier ? "Enregistrer le fournisseur" : "Ajouter le fournisseur"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function OfferForm({
  supplierId,
  products,
}: {
  supplierId: number;
  products: { id: number; name: string; unit: string }[];
}) {
  const [state, action, pending] = useActionState<SupplierFormState, FormData>(saveOffer, null);
  return (
    <form onSubmit={keepValues(action)} key={state?.ok ? state.at : "form"} aria-label="Ajouter une marchandise">
      <input type="hidden" name="supplierId" value={supplierId} />
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="o-product">Marchandise</label>
          <ProductField
            id="o-product"
            name="productId"
            required
            products={products.map((p) => ({ id: p.id, name: `${p.name} (${p.unit})` }))}
          />
        </div>
        <div className="field">
          <label htmlFor="o-price">Prix en septims</label>
          <input id="o-price" name="price" type="number" min={0} step={1} required />
        </div>
        <div className="field">
          <label htmlFor="o-qty">Pour (unités)</label>
          <input id="o-qty" name="qty" type="number" min={1} step={1} defaultValue={1} required />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        Enregistrer la marchandise
      </button>
      <Status state={state} />
    </form>
  );
}

export function DeleteSupplierButton({ id, name }: { id: number; name: string }) {
  return (
    <form action={deleteSupplier}>
      <input type="hidden" name="id" value={id} />
      <button
        className="btn btn-small minus"
        type="submit"
        onClick={(e) => {
          if (!window.confirm(`Supprimer ${name} et tout ce qu'il propose ?`)) e.preventDefault();
        }}
      >
        Supprimer le fournisseur
      </button>
    </form>
  );
}
