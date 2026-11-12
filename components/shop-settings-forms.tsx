"use client";

import { useActionState } from "react";
import { removeShop, saveShop, type ShopSettingsState } from "@/app/[boutique]/reglages/actions";
import { keepValues } from "@/components/keep-values";

function Status({ state }: { state: ShopSettingsState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "6px 0 0" }}>
      {state.message}
    </p>
  );
}

/** The shop's name and address. The comptoir's address can't change. */
export function ShopForm({ name, slug, fixedSlug }: { name: string; slug: string; fixedSlug: boolean }) {
  const [state, action, pending] = useActionState(saveShop, null);
  return (
    <form onSubmit={keepValues(action)}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="shop-name">Nom de la boutique</label>
          <input id="shop-name" name="name" defaultValue={name} required maxLength={60} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="shop-slug">Adresse</label>
          <input
            id="shop-slug"
            name="slug"
            defaultValue={slug}
            required
            maxLength={60}
            autoComplete="off"
            disabled={fixedSlug}
            aria-describedby="shop-slug-hint"
          />
          <span id="shop-slug-hint" className="small muted">
            {fixedSlug
              ? "L'adresse du comptoir ne change pas : ses anciens liens y mènent."
              : "Changer l'adresse casse les liens déjà donnés vers la boutique."}
          </span>
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        Enregistrer la boutique
      </button>
      <Status state={state} />
    </form>
  );
}

/** Deletes the shop, once its name is typed again. */
export function DeleteShopForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(removeShop, null);
  return (
    <form onSubmit={keepValues(action)}>
      <div className="field" style={{ maxWidth: 420 }}>
        <label htmlFor="shop-confirm">Pour confirmer, écris « {name} »</label>
        <input id="shop-confirm" name="confirm" required maxLength={60} autoComplete="off" />
      </div>
      <button className="btn minus" type="submit" disabled={pending}>
        Supprimer la boutique
      </button>
      <Status state={state} />
    </form>
  );
}
