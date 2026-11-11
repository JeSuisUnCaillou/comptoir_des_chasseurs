"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { ProductCombobox } from "@/components/product-combobox";
import { recordTransaction, type TransactionState } from "@/app/(comptoir)/achat-vente/actions";
import type { Product, TransactionKind } from "@/lib/db/schema";
import { keepValues } from "@/lib/keep-values";
import { CATEGORY_LABELS, buyTotal, plural, rate, sellTotal, septims, type Total } from "@/lib/pricing";

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

/** One merchandise of the entry, as the member is filling it in. */
type Line = {
  key: number;
  productId: string;
  quantity: string;
  amount: string;
  // The amount follows the tariff until the member takes it over with the pencil.
  manual: boolean;
};

function newLine(key: number): Line {
  return { key, productId: "", quantity: "1", amount: "", manual: false };
}

/** What a line computes from the tariff, and what it adds to the total. */
function evaluate(line: Line, kind: TransactionKind, products: TransactionProduct[], citizen: boolean) {
  const product = products.find((p) => String(p.id) === line.productId);
  const qty = Number(line.quantity);
  const validQty = Number.isInteger(qty) && qty > 0;
  // Only buybacks have a citizens' price, and only for the products that set one.
  const citizenPrice = kind === "rachat" && product?.citizenBuyPrice != null;
  const tariff: (Total & { bulk?: boolean }) | null =
    product && validQty
      ? kind === "vente"
        ? sellTotal(product, qty)
        : buyTotal(product, qty, { citizen: citizenPrice && citizen })
      : null;
  const suggested = tariff ? Math.round(tariff.value) : null;
  const auto = suggested != null && !line.manual;
  const amount = auto ? suggested : Number(line.amount);
  return {
    product,
    qty: validQty ? qty : 0,
    citizenPrice,
    tariff,
    suggested,
    auto,
    shownAmount: auto ? String(suggested) : line.amount,
    value: Number.isInteger(amount) && amount > 0 ? amount : 0,
  };
}

export function TransactionForm({
  kind,
  products,
}: {
  kind: TransactionKind;
  products: TransactionProduct[];
}) {
  const [state, action, pending] = useActionState<TransactionState, FormData>(recordTransaction, null);
  const sale = kind === "vente";
  const submitLabel = sale ? "Confirmer la vente" : "Confirmer l'achat";
  const [lines, setLines] = useState<Line[]>([newLine(0)]);
  const nextKey = useRef(1);
  // One seller for the whole purchase: the box applies to every line that has a citizens' price.
  const [citizen, setCitizen] = useState(false);
  const evaluated = lines.map((line) => evaluate(line, kind, products, citizen));
  const total = evaluated.reduce((sum, e) => sum + e.value, 0);
  const citizenProducts = evaluated.flatMap((e) => (e.citizenPrice && e.product ? [e.product] : []));
  const uniqueCitizenProducts = citizenProducts.filter((p, i) => citizenProducts.indexOf(p) === i);
  // Once no line has a citizens' price, the box goes away unticked: it never comes back ticked on its own.
  if (citizen && uniqueCitizenProducts.length === 0) setCitizen(false);

  // A product sold on several lines must have enough stock for all of them.
  const wanted = new Map<TransactionProduct, number>();
  if (sale) for (const e of evaluated) if (e.product) wanted.set(e.product, (wanted.get(e.product) ?? 0) + e.qty);
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
      <input type="hidden" name="kind" value={kind} />
      <div className="tx-lines">
        {lines.map((line, index) => {
          const e = evaluated[index];
          const id = `t-${line.key}`;
          return (
            <fieldset
              key={line.key}
              className="tx-line"
              aria-label={`Marchandise ${index + 1}`}
            >
              {lines.length > 1 && (
                <div className="tx-line-head">
                  <span className="eyebrow">Marchandise {index + 1}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Retirer cette marchandise"
                    aria-label={`Retirer la marchandise ${index + 1}`}
                    onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              <div className="tx-grid">
                <div className="field full">
                  <label htmlFor={`${id}-product`}>Article ou marchandise</label>
                  <ProductCombobox
                    id={`${id}-product`}
                    name="productId"
                    required
                    placeholder="Choisir ou taper un nom…"
                    products={choices}
                    extras={[{ id: OTHER, name: "Autre article (hors stock)…" }]}
                    value={line.productId || null}
                    onChange={(productId) => update(line.key, { productId })}
                  />
                  {e.product && (
                    <span className="small muted" data-testid="stock-dispo">
                      En stock : {e.product.stock} {plural(e.product.unit, e.product.stock)}
                    </span>
                  )}
                </div>
                {line.productId === OTHER ? (
                  <div className="field full">
                    <label htmlFor={`${id}-label`}>Nom de l&apos;article</label>
                    <input id={`${id}-label`} name="label" required maxLength={100} />
                  </div>
                ) : (
                  // Keeps the fields of every line aligned in the submitted form.
                  <input type="hidden" name="label" value="" />
                )}
                <div className="field">
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
                <div className="field">
                  <label htmlFor={`${id}-amount`}>Montant (septims)</label>
                  <div className="amount-row">
                    <input
                      id={`${id}-amount`}
                      name="amount"
                      type="number"
                      min={0}
                      step={1}
                      required
                      readOnly={e.auto}
                      value={e.shownAmount}
                      onChange={(ev) => update(line.key, { amount: ev.target.value })}
                    />
                    {e.auto && (
                      <button
                        type="button"
                        className="icon-btn"
                        title="Modifier le montant"
                        aria-label="Modifier le montant"
                        onClick={(ev) => {
                          const input = ev.currentTarget.parentElement?.querySelector("input");
                          update(line.key, { amount: String(e.suggested), manual: true });
                          requestAnimationFrame(() => input?.focus());
                        }}
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                  </div>
                  {e.suggested != null && (
                    <span className="small muted tariff-hint" data-testid="tarif">
                      {e.auto ? "Calculé avec le tarif" : `Tarif : ${septims(e.suggested)}`}
                      {e.tariff?.bulk ? " (prix de gros)" : ""}
                      {e.citizenPrice && citizen ? " (prix citoyen d'Estemarche)" : ""}
                      {e.tariff && !e.tariff.complete ? " (lot incomplet, arrondi)" : ""}
                      {!e.auto && (
                        <button
                          type="button"
                          className="btn btn-small btn-ghost"
                          onClick={() => update(line.key, { manual: false })}
                        >
                          Revenir au tarif
                        </button>
                      )}
                    </span>
                  )}
                  {e.product && e.suggested == null && (
                    <span className="small muted">Pas de tarif pour cette opération : indique le montant.</span>
                  )}
                </div>
              </div>
            </fieldset>
          );
        })}
      </div>
      <div className="tx-total-row">
        <button
          type="button"
          className="btn btn-small"
          onClick={() => setLines((all) => [...all, newLine(nextKey.current++)])}
        >
          <Plus size={14} /> Ajouter une marchandise
        </button>
        <p className="tx-total" data-testid="total" aria-live="polite">
          {sale ? "Total de la vente" : "Total de l'achat"} : <strong>{septims(total)}</strong>
        </p>
      </div>
      <div className="tx-grid">
        {uniqueCitizenProducts.length > 0 && (
          <div className="field full">
            <label className="check">
              <input
                type="checkbox"
                name="citizen"
                checked={citizen}
                onChange={(ev) => setCitizen(ev.target.checked)}
              />{" "}
              Le vendeur est citoyen d&apos;Estemarche
            </label>
            {uniqueCitizenProducts.map((p) => (
              <span key={p.id} className="small muted">
                {uniqueCitizenProducts.length > 1 && `${p.name} · `}
                Citoyens : {rate(p.citizenBuyPrice!, p.buyQty)}
                {p.buyPrice != null && ` · autres vendeurs : ${rate(p.buyPrice, p.buyQty)}`}
              </span>
            ))}
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
      {short.map((p) => (
        <p key={p.id} className="notice error" role="alert">
          Stock insuffisant{lines.length > 1 ? ` de ${p.name}` : ""} : il ne reste que {p.stock}{" "}
          {plural(p.unit, p.stock)}.
        </p>
      ))}
      {state && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <p className="small muted">Le montant de chaque marchandise est le total pour sa quantité.</p>
      <button className="btn btn-primary" type="submit" disabled={pending || short.length > 0}>
        <Plus size={16} /> {submitLabel}
      </button>
    </form>
  );
}
