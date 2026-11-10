"use client";

import { Pencil, Plus } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { ProductCombobox } from "@/components/product-combobox";
import { recordTransaction, type TransactionState } from "@/app/(comptoir)/achat-vente/actions";
import type { Product, TransactionKind } from "@/lib/db/schema";
import { keepValues } from "@/lib/keep-values";
import { CATEGORY_LABELS, buyTotal, plural, rate, sellTotal, septims } from "@/lib/pricing";

export type TransactionProduct = Pick<
  Product,
  | "id"
  | "name"
  | "category"
  | "unit"
  | "stock"
  | "buyPrice"
  | "buyQty"
  | "citizenBuyPrice"
  | "sellPrice"
  | "sellQty"
  | "bulkMin"
  | "bulkPrice"
  | "bulkQty"
>;

const OTHER = "autre";

export function TransactionForm({
  kind,
  products,
}: {
  kind: TransactionKind;
  products: TransactionProduct[];
}) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(recordTransaction, null);
  const submitLabel = kind === "vente" ? "Confirmer la vente" : "Confirmer l'achat";
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  // The amount follows the tariff until the member takes it over with the pencil.
  const [manual, setManual] = useState(false);
  const [citizen, setCitizen] = useState(false);
  const amountInput = useRef<HTMLInputElement>(null);
  const product = products.find((p) => String(p.id) === productId);
  const qty = Number(quantity);
  const validQty = Number.isInteger(qty) && qty > 0;
  // Only buybacks have a citizens' price, and only for the products that set one.
  const citizenPrice = kind === "rachat" && product?.citizenBuyPrice != null;
  const tariff =
    product && validQty
      ? kind === "vente"
        ? sellTotal(product, qty)
        : buyTotal(product, qty, { citizen: citizenPrice && citizen })
      : null;
  const suggested = tariff ? Math.round(tariff.value) : null;
  const auto = suggested != null && !manual;
  const short = kind === "vente" && product && validQty && qty > product.stock;
  // Groups keep the catalogue's category order; names are sorted inside each.
  const choices = (Object.keys(CATEGORY_LABELS) as Product["category"][]).flatMap((category) =>
    products
      .filter((p) => p.category === category)
      .map((p) => ({ id: String(p.id), name: p.name, group: CATEGORY_LABELS[category] })),
  );

  return (
    <form onSubmit={keepValues(action)}>
      <input type="hidden" name="kind" value={kind} />
      <div className="tx-grid">
        <div className="field full">
          <label htmlFor="t-product">Article ou marchandise</label>
          <ProductCombobox
            id="t-product"
            name="productId"
            required
            placeholder="Choisir ou taper un nom…"
            products={choices}
            extras={[{ id: OTHER, name: "Autre article (hors stock)…" }]}
            value={productId || null}
            onChange={(id) => {
              setProductId(id);
              // Each seller says again whether they are a citizen.
              setCitizen(false);
            }}
          />
          {product && (
            <span className="small muted" data-testid="stock-dispo">
              En stock : {product.stock} {plural(product.unit, product.stock)}
            </span>
          )}
        </div>
        {productId === OTHER && (
          <div className="field full">
            <label htmlFor="t-label">Nom de l&apos;article</label>
            <input id="t-label" name="label" required maxLength={100} />
          </div>
        )}
        <div className="field">
          <label htmlFor="t-quantity">Quantité</label>
          <input
            id="t-quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="t-amount">Montant total (septims)</label>
          <div className="amount-row">
            <input
              ref={amountInput}
              id="t-amount"
              name="amount"
              type="number"
              min={0}
              step={1}
              required
              readOnly={auto}
              value={auto ? String(suggested) : amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {auto && (
              <button
                type="button"
                className="icon-btn"
                title="Modifier le montant"
                aria-label="Modifier le montant"
                onClick={() => {
                  setAmount(String(suggested));
                  setManual(true);
                  requestAnimationFrame(() => amountInput.current?.focus());
                }}
              >
                <Pencil size={18} />
              </button>
            )}
          </div>
          {suggested != null && (
            <span className="small muted tariff-hint" data-testid="tarif">
              {auto ? "Calculé avec le tarif" : `Tarif : ${septims(suggested)}`}
              {tariff && "bulk" in tariff && tariff.bulk ? " (prix de gros)" : ""}
              {citizenPrice && citizen ? " (prix citoyen d'Estemarche)" : ""}
              {tariff && !tariff.complete ? " (lot incomplet, arrondi)" : ""}
              {!auto && (
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setManual(false)}>
                  Revenir au tarif
                </button>
              )}
            </span>
          )}
          {product && suggested == null && (
            <span className="small muted">Pas de tarif pour cette opération : indique le montant.</span>
          )}
        </div>
        {citizenPrice && (
          <div className="field full">
            <label className="check">
              <input
                type="checkbox"
                name="citizen"
                checked={citizen}
                onChange={(e) => setCitizen(e.target.checked)}
              />{" "}
              Le vendeur est citoyen d&apos;Estemarche
            </label>
            <span className="small muted">
              Citoyens : {rate(product.citizenBuyPrice!, product.buyQty)}
              {product.buyPrice != null && ` · autres vendeurs : ${rate(product.buyPrice, product.buyQty)}`}
            </span>
          </div>
        )}
        <div className="field full">
          <label htmlFor="t-counterparty">Nom du client / vendeur RP (facultatif)</label>
          <input id="t-counterparty" name="counterparty" maxLength={100} />
        </div>
        <div className="field full">
          <label htmlFor="t-notes">Notes (facultatif)</label>
          <textarea id="t-notes" name="notes" rows={3} maxLength={500} />
        </div>
      </div>
      {short && (
        <p className="notice error" role="alert">
          Stock insuffisant : il ne reste que {product.stock} {plural(product.unit, product.stock)}.
        </p>
      )}
      {state && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <p className="small muted">Le montant indiqué est le total pour la quantité saisie.</p>
      <button className="btn btn-primary" type="submit" disabled={pending || !!short}>
        <Plus size={16} /> {submitLabel}
      </button>
    </form>
  );
}
