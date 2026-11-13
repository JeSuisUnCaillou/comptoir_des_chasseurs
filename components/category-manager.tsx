"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { saveCategory, type CategoryFormState } from "@/app/[boutique]/marchandises/actions";
import { keepValues } from "@/components/keep-values";

export type ManagedCategory = { id: number; name: string; hides: boolean; products: number };

function Feedback({ state }: { state: CategoryFormState }) {
  if (!state) return null;
  return "error" in state ? (
    <p className="small minus" role="alert">
      {state.error}
    </p>
  ) : (
    <p className="small muted" role="status">
      {state.ok}
    </p>
  );
}

/** One category: its name to change, how many merchandises it holds, and its deletion once empty. */
function CategoryRow({ category }: { category: ManagedCategory }) {
  const [state, action, pending] = useActionState<CategoryFormState, FormData>(saveCategory, null);
  const label = `${category.products} marchandise${category.products > 1 ? "s" : ""}`;
  return (
    <li className="category-row" data-testid={`categorie-${category.name}`}>
      <form onSubmit={keepValues(action)} className="inline-form">
        <input type="hidden" name="id" value={category.id} />
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={category.name}
          aria-label={`Nom de la catégorie ${category.name}`}
        />
        <button className="btn btn-small" type="submit" disabled={pending}>
          Renommer
        </button>
        <button
          className="icon-btn"
          type="submit"
          name="intent"
          value="supprimer"
          formNoValidate
          disabled={pending}
          title={`Supprimer la catégorie ${category.name}`}
          aria-label={`Supprimer la catégorie ${category.name}`}
        >
          <Trash2 size={16} />
        </button>
      </form>
      <p className="small muted">
        {label}
        {category.hides && " · se transforment en cuir par lots"}
      </p>
      <Feedback state={state} />
    </li>
  );
}

/** A new category, the form emptied once it is added. */
function AddCategory() {
  const [state, action, pending] = useActionState<CategoryFormState, FormData>(saveCategory, null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state && "ok" in state) setKey((k) => k + 1);
  }, [state]);
  return (
    <>
      <form key={key} onSubmit={keepValues(action)} className="inline-form category-add">
        <input name="name" required maxLength={60} aria-label="Nouvelle catégorie" placeholder="Nouvelle catégorie" />
        <button className="btn btn-small" type="submit" disabled={pending}>
          <Plus size={14} /> Ajouter
        </button>
      </form>
      <Feedback state={state} />
    </>
  );
}

/** The shop's categories on Gérer les marchandises: rename, add, delete. */
export function CategoryManager({ categories }: { categories: ManagedCategory[] }) {
  return (
    <>
      <ul className="category-list">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </ul>
      <AddCategory />
    </>
  );
}
