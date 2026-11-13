"use client";

import { ChevronLeft, ChevronRight, Minus, PackagePlus, Plus } from "lucide-react";
import Link from "next/link";
import { useShopPath } from "@/components/use-shop-path";
import { useActionState, useCallback, useEffect, useId, useMemo, useState } from "react";
import { recordMovement, type MoveState } from "@/app/[boutique]/inventaire/actions";
import { formatNumber, plural } from "@/lib/pricing";
import type { CategoryChoice } from "@/components/category-select";
import { keepValues } from "@/components/keep-values";
import { NewStockProductForm } from "@/components/new-stock-product-form";
import type { GroupChoice } from "@/components/product-price-fields";

export type StockItem = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  unit: string;
  stock: number;
};

function MoveForm({
  item,
  direction,
  onDone,
}: {
  item: StockItem;
  direction: "in" | "out";
  onDone: () => void;
}) {
  const id = useId();
  const [state, action, pending] = useActionState<MoveState, FormData>(recordMovement, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form onSubmit={keepValues(action)} className="move-form" aria-label={direction === "in" ? "Entrée en stock" : "Sortie de stock"}>
      <input type="hidden" name="productId" value={item.id} />
      <input type="hidden" name="direction" value={direction} />
      <label htmlFor={`${id}-q`} className="small muted">
        {direction === "in" ? "Quantité ajoutée" : "Quantité retirée"}
      </label>
      <input id={`${id}-q`} name="quantity" type="number" min={1} max={direction === "out" ? item.stock : undefined} required autoFocus />
      <label htmlFor={`${id}-r`} className="small muted">
        Motif
      </label>
      <input id={`${id}-r`} name="reason" required maxLength={200} placeholder="ex. transformation en cuir" />
      {state && !state.ok && (
        <p className="small minus" role="alert">
          {state.message}
        </p>
      )}
      <div className="move-actions">
        <button className="btn btn-small" type="submit" disabled={pending}>
          Valider
        </button>
        <button className="btn btn-small btn-ghost" type="button" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}

function StockCard({ item }: { item: StockItem }) {
  const [open, setOpen] = useState<"in" | "out" | null>(null);
  const close = useMemo(() => () => setOpen(null), []);
  return (
    <article className="stock-card" data-testid={`stock-${item.name}`}>
      <div className="stock-card-head">
        <span className="small muted">{item.categoryName}</span>
        {item.stock === 0 && <span className="badge badge-red">Rupture</span>}
      </div>
      <h3>{item.name}</h3>
      <p className="stock-qty">
        <strong data-testid="stock-value">{formatNumber(item.stock)}</strong>{" "}
        <span className="small muted">{plural(item.unit, item.stock)}</span>
      </p>
      {open ? (
        <MoveForm item={item} direction={open} onDone={close} />
      ) : (
        <div className="move-actions">
          <button className="btn btn-small plus" type="button" onClick={() => setOpen("in")}>
            <Plus size={14} /> Entrée
          </button>
          <button
            className="btn btn-small minus"
            type="button"
            onClick={() => setOpen("out")}
            disabled={item.stock === 0}
          >
            <Minus size={14} /> Sortie
          </button>
        </div>
      )}
    </article>
  );
}

const CARDS_PER_PAGE = 24;

/** `canManage`: a gérant, who can price a new merchandise. */
export function StockBoard({
  items,
  categories,
  canManage,
  groups,
}: {
  items: StockItem[];
  categories: CategoryChoice[];
  canManage: boolean;
  /** The shop's privileged groups, priced with a new merchandise. */
  groups: GroupChoice[];
}) {
  const id = useId();
  const path = useShopPath();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  // Name prefilled in the "Nouvelle marchandise" form; null while it is closed.
  const [creating, setCreating] = useState<string | null>(null);
  const closeCreate = useCallback(() => setCreating(null), []);
  // Shows the new merchandise's card once it exists.
  const created = useCallback((name: string) => {
    setCreating(null);
    setCategory(undefined);
    setQuery(name);
    setPage(1);
  }, []);
  const normalized = query.trim().toLocaleLowerCase("fr");
  const visible = items.filter(
    (i) =>
      (category == null || i.categoryId === category) &&
      (!normalized || i.name.toLocaleLowerCase("fr").includes(normalized)),
  );
  const pages = Math.max(1, Math.ceil(visible.length / CARDS_PER_PAGE));
  const current = Math.min(page, pages);
  const shown = visible.slice((current - 1) * CARDS_PER_PAGE, current * CARDS_PER_PAGE);

  return (
    <>
      <div className="calc-inputs">
        <div className="field">
          <label htmlFor={`${id}-s`}>Rechercher une marchandise</label>
          <input id={`${id}-s`} type="search" value={query} onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-c`}>Catégorie</label>
          <select id={`${id}-c`} value={category ?? ""} onChange={(e) => {
              setCategory(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {creating != null ? (
        <NewStockProductForm
          name={creating}
          category={category}
          categories={categories}
          canSetPrices={canManage}
          groups={groups}
          onCreated={created}
          onCancel={closeCreate}
        />
      ) : (
        <div className="stock-tools">
          <button className="btn btn-small" type="button" onClick={() => setCreating(visible.length === 0 ? query.trim() : "")}>
            <PackagePlus size={14} /> Nouvelle marchandise
          </button>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="muted">
          Aucune marchandise ne correspond.
          {creating == null && query.trim() && " Tu peux la créer avec « Nouvelle marchandise »."}
        </p>
      ) : (
        <div className="stock-grid">
          {shown.map((item) => (
            <StockCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav className="pagination" aria-label="Pages du stock">
          <button
            className="btn btn-small btn-ghost"
            type="button"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={14} /> Précédent
          </button>
          <span className="small muted">
            Page {current} sur {pages} · {visible.length} marchandises
          </span>
          <button
            className="btn btn-small btn-ghost"
            type="button"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Suivant <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </>
  );
}
