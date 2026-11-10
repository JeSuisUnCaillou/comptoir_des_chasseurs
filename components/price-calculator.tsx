"use client";

import { useId, useState } from "react";
import type { Product } from "@/lib/db/schema";
import { buyTotal, margin, sellTotal, septims, transformation, type Total } from "@/lib/pricing";

type CalcProduct = Pick<
  Product,
  | "id"
  | "name"
  | "unit"
  | "buyPrice"
  | "buyQty"
  | "sellPrice"
  | "sellQty"
  | "bulkMin"
  | "bulkPrice"
  | "bulkQty"
  | "hidesPerBatch"
  | "leatherPerBatch"
>;

function show(total: Total | null) {
  if (!total) return "—";
  return septims(Math.round(total.value * 10) / 10);
}

export function PriceCalculator({ products }: { products: CalcProduct[] }) {
  const id = useId();
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("fr");
  const choices = normalized ? products.filter((p) => p.name.toLocaleLowerCase("fr").includes(normalized)) : products;
  // The chosen product, or the first match when the search hides it.
  const product = choices.find((p) => p.id === productId) ?? choices[0];
  const search = (
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label htmlFor={`${id}-s`}>Chercher une marchandise</label>
      <input id={`${id}-s`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
    </div>
  );
  if (!product)
    return (
      <div data-testid="calculateur">
        <div className="calc-inputs">{search}</div>
        <p className="muted">Aucune marchandise ne correspond.</p>
      </div>
    );

  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  const buy = buyTotal(product, qty);
  const sell = sellTotal(product, qty);
  const gross = margin(product, qty);
  const transfo = transformation(product, qty);
  const incomplete = (buy && !buy.complete) || (sell && !sell.complete);

  return (
    <div data-testid="calculateur">
      <div className="calc-inputs">
        {search}
        <div className="field">
          <label htmlFor={`${id}-p`}>Marchandise</label>
          <select id={`${id}-p`} value={product.id} onChange={(e) => setProductId(Number(e.target.value))}>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-q`}>Quantité</label>
          <input
            id={`${id}-q`}
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.valueAsNumber)}
          />
        </div>
      </div>
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total du rachat</div>
          <div className="stat-value minus" data-testid="calc-rachat">
            {show(buy)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Total de la vente</div>
          <div className="stat-value plus" data-testid="calc-vente">
            {show(sell)}
          </div>
          {sell && <div className="small muted">{sell.bulk ? "Tarif de gros" : "Tarif normal"}</div>}
        </div>
        <div className="stat">
          <div className="stat-label">Bénéfice brut</div>
          <div className="stat-value plus" data-testid="calc-benefice">
            {gross == null ? "—" : septims(Math.round(gross * 10) / 10, { signed: true })}
          </div>
        </div>
      </div>
      {transfo && (
        <div className="notice" style={{ marginTop: 16, marginBottom: 0 }} data-testid="calc-transfo">
          <strong>Transformation possible</strong>
          <div>
            {transfo.batches} lot{transfo.batches > 1 ? "s" : ""} → {transfo.leather} cuir
            {transfo.leather > 1 ? "s" : ""}
          </div>
          <div className="small muted">Peaux restantes : {transfo.remaining}</div>
        </div>
      )}
      {incomplete && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Lot incomplet : le prix est fixé par lots entiers, le total est arrondi.
        </p>
      )}
    </div>
  );
}
