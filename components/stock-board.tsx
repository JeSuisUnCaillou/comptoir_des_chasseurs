"use client";

import { Minus, Plus } from "lucide-react";
import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { recordMovement, type MoveState } from "@/app/(comptoir)/inventaire/actions";
import type { ProductCategory } from "@/lib/db/schema";
import { CATEGORY_LABELS, formatNumber, plural } from "@/lib/pricing";

export type StockItem = {
  id: number;
  name: string;
  category: ProductCategory;
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
    <form action={action} className="move-form" aria-label={direction === "in" ? "Entrée en stock" : "Sortie de stock"}>
      <input type="hidden" name="productId" value={item.id} />
      <input type="hidden" name="direction" value={direction} />
      <label htmlFor={`${id}-q`} className="small muted">
        {direction === "in" ? "Quantité entrée" : "Quantité sortie"}
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
        <span className="small muted">{CATEGORY_LABELS[item.category]}</span>
        {item.stock > 0 ? (
          <span className="badge badge-green">En stock</span>
        ) : (
          <span className="badge badge-red">Rupture</span>
        )}
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

export function StockBoard({ items }: { items: StockItem[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"" | ProductCategory>("");
  const normalized = query.trim().toLocaleLowerCase("fr");
  const visible = items.filter(
    (i) =>
      (!category || i.category === category) &&
      (!normalized || i.name.toLocaleLowerCase("fr").includes(normalized)),
  );

  return (
    <>
      <div className="calc-inputs">
        <div className="field">
          <label htmlFor={`${id}-s`}>Rechercher une marchandise</label>
          <input id={`${id}-s`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-c`}>Catégorie</label>
          <select id={`${id}-c`} value={category} onChange={(e) => setCategory(e.target.value as ProductCategory | "")}>
            <option value="">Toutes</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="muted">Aucune marchandise ne correspond.</p>
      ) : (
        <div className="stock-grid">
          {visible.map((item) => (
            <StockCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
