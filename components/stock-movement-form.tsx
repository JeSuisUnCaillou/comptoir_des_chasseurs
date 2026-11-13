"use client";

import { ArrowDownToLine, ArrowUpFromLine, Plus, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { recordStockMovement, type MoveState } from "@/app/[boutique]/inventaire/actions";
import { keepValues } from "@/components/keep-values";
import { ProductCombobox } from "@/components/product-combobox";
import type { Product } from "@/lib/db/schema";
import { CATEGORY_LABELS, plural } from "@/lib/pricing";
import { MAX_LINES } from "@/lib/transaction-kinds";

export type StockMovementProduct = Pick<Product, "id" | "name" | "category" | "unit" | "stock">;

const REASONS = ["Arrivage", "Transformation", "Perte", "Correction d'inventaire"];

/** One merchandise of the movement, as the member is filling it in. */
type Line = { key: number; productId: string; quantity: string };

function newLine(key: number): Line {
  return { key, productId: "", quantity: "1" };
}

/**
 * Several merchandises in or out of stock at once, with one reason and no
 * septims. Each line shows the stock it has now, and what it will have after.
 */
export function StockMovementForm({ products }: { products: StockMovementProduct[] }) {
  const [state, action, pending] = useActionState<MoveState, FormData>(recordStockMovement, null);
  const [direction, setDirection] = useState<"in" | "out" | "">("");
  const [lines, setLines] = useState<Line[]>([newLine(0)]);
  const nextKey = useRef(1);

  const productOf = (line: Line) => products.find((p) => String(p.id) === line.productId);
  const quantityOf = (line: Line) => {
    const qty = Number(line.quantity);
    return Number.isInteger(qty) && qty > 0 ? qty : 0;
  };
  // A merchandise taken out on several lines must have enough stock for all of them.
  const wanted = new Map<StockMovementProduct, number>();
  if (direction === "out") {
    for (const line of lines) {
      const product = productOf(line);
      if (product) wanted.set(product, (wanted.get(product) ?? 0) + quantityOf(line));
    }
  }
  const short = [...wanted].filter(([p, qty]) => qty > p.stock).map(([p]) => p);

  // Groups keep the catalogue's category order; names are sorted inside each.
  const choices = (Object.keys(CATEGORY_LABELS) as Product["category"][]).flatMap((category) =>
    products
      .filter((p) => p.category === category)
      .map((p) => ({ id: String(p.id), name: p.name, group: CATEGORY_LABELS[category] })),
  );

  function update(key: number, change: Partial<Line>) {
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }

  return (
    <form onSubmit={keepValues(action)}>
      <fieldset className="direction">
        <legend>Sens</legend>
        <label className={direction === "in" ? "checked" : undefined}>
          <input
            type="radio"
            name="direction"
            value="in"
            required
            checked={direction === "in"}
            onChange={() => setDirection("in")}
          />
          <ArrowDownToLine size={20} /> Entrée en stock
        </label>
        <label className={direction === "out" ? "checked" : undefined}>
          <input
            type="radio"
            name="direction"
            value="out"
            checked={direction === "out"}
            onChange={() => setDirection("out")}
          />
          <ArrowUpFromLine size={20} /> Sortie de stock
        </label>
      </fieldset>
      <div className="tx-lines">
        {lines.map((line, index) => {
          const product = productOf(line);
          const qty = quantityOf(line);
          const after = product && direction ? product.stock + (direction === "in" ? qty : -qty) : null;
          const id = `m-${line.key}`;
          return (
            <fieldset key={line.key} className="tx-line" aria-label={`Marchandise ${index + 1}`}>
              <div className="tx-line-row">
                <div className="field tx-product">
                  <label htmlFor={`${id}-product`}>Marchandise</label>
                  <ProductCombobox
                    id={`${id}-product`}
                    name="productId"
                    required
                    placeholder="Choisir ou taper un nom…"
                    products={choices}
                    value={line.productId || null}
                    onChange={(productId) => update(line.key, { productId })}
                  />
                  {product && (
                    <span className="small muted" data-testid="stock-dispo">
                      En stock :{" "}
                      <strong className="tx-figure">
                        {product.stock} {plural(product.unit, product.stock)}
                      </strong>
                      {after != null && after >= 0 && (
                        <>
                          {" "}
                          → après : <strong className="tx-figure">{after}</strong>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <div className="field tx-qty">
                  <label htmlFor={`${id}-quantity`}>Quantité</label>
                  <input
                    id={`${id}-quantity`}
                    name="quantity"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={line.quantity}
                    onChange={(ev) => update(line.key, { quantity: ev.target.value })}
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn tx-remove"
                    title="Retirer cette marchandise"
                    aria-label={`Retirer la marchandise ${index + 1}`}
                    onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="tx-total-row">
        <button
          type="button"
          className="btn btn-small"
          disabled={lines.length >= MAX_LINES}
          title={lines.length >= MAX_LINES ? `${MAX_LINES} marchandises au plus` : undefined}
          onClick={() => setLines((all) => [...all, newLine(nextKey.current++)])}
        >
          <Plus size={14} /> Ajouter une marchandise
        </button>
      </div>
      <div className="tx-grid">
        <div className="field full">
          <label htmlFor="m-reason">Motif</label>
          <input
            id="m-reason"
            name="reason"
            required
            maxLength={200}
            list="m-reasons"
            placeholder="Arrivage, transformation, perte…"
          />
          <datalist id="m-reasons">
            {REASONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
      </div>
      {short.map((p) => (
        <p key={p.id} className="notice error" role="alert">
          Stock insuffisant{lines.length > 1 ? ` de ${p.name}` : ""} : il ne reste que {p.stock}{" "}
          {plural(p.unit, p.stock)}.
        </p>
      ))}
      {state && !state.ok && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending || short.length > 0}>
        <Plus size={16} /> Inscrire le mouvement
      </button>
    </form>
  );
}
