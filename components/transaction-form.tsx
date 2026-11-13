"use client";

import { ArrowLeft, ArrowLeftRight, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { Combobox, type Choice } from "@/components/combobox";
import { ProductCombobox } from "@/components/product-combobox";
import { recordTransaction, type TransactionState } from "@/app/[boutique]/achat-vente/actions";
import type { Product, TransactionKind } from "@/lib/db/schema";
import { keepValues } from "@/components/keep-values";
import { useShopPath } from "@/components/use-shop-path";
import { DRAFT_PARAM, encodeDraft, type TransactionDraft } from "@/lib/transaction-draft";
import { MAX_LINES } from "@/lib/transaction-kinds";
import { CATEGORY_LABELS, appliedRate, buyTotal, plural, rate, sellTotal, septims, type Total } from "@/lib/pricing";

export type TransactionProduct = Pick<
  Product,
  | "id"
  | "name"
  | "category"
  | "unit"
  | "stock"
  | "buyPrice"
  | "buyQty"
  | "sellPrice"
  | "sellQty"
  | "bulkMin"
  | "bulkPrice"
  | "bulkQty"
> & {
  /** The buyback prices of the shop's privileged groups that have one, in the groups' order. */
  privileged: { groupId: number; name: string; price: number }[];
};

const OTHER = "autre";

/** One merchandise of the entry, as the member is filling it in. */
type Line = {
  key: number;
  productId: string;
  quantity: string;
  label: string;
  amount: string;
  // The amount follows the tariff until the member takes it over with the pencil.
  manual: boolean;
};

function newLine(key: number): Line {
  return { key, productId: "", quantity: "1", label: "", amount: "", manual: false };
}

/** The lines carried over from the other form; an amount typed by hand stays typed by hand. */
function draftLines(draft: TransactionDraft | null, products: TransactionProduct[]): Line[] {
  if (!draft) return [newLine(0)];
  return draft.lines.map((l, key) => ({
    key,
    productId: l.productId === OTHER || products.some((p) => String(p.id) === l.productId) ? l.productId : "",
    quantity: l.quantity,
    label: l.label,
    amount: l.amount ?? "",
    manual: l.amount != null,
  }));
}

/** What a line computes from the tariff, and what it adds to the total. */
function evaluate(line: Line, kind: TransactionKind, products: TransactionProduct[], group: number | null) {
  const product = products.find((p) => String(p.id) === line.productId);
  const qty = Number(line.quantity);
  const validQty = Number.isInteger(qty) && qty > 0;
  // Only buybacks have privileged prices, and only for the products that set one for the seller's group.
  const privileged = (kind === "rachat" && product?.privileged.find((p) => p.groupId === group)) || null;
  const tariff: (Total & { bulk?: boolean }) | null =
    product && validQty
      ? kind === "vente"
        ? sellTotal(product, qty)
        : buyTotal(product, qty, { privileged })
      : null;
  const unitPrice = product ? appliedRate(product, kind === "vente" ? "vente" : "rachat", validQty ? qty : 1, { privileged }) : null;
  const suggested = tariff ? Math.round(tariff.value) : null;
  const auto = suggested != null && !line.manual;
  const amount = auto ? suggested : Number(line.amount);
  return {
    product,
    qty: validQty ? qty : 0,
    privileged,
    tariff,
    unitPrice,
    suggested,
    auto,
    shownAmount: auto ? String(suggested) : line.amount,
    value: Number.isInteger(amount) && amount > 0 ? amount : 0,
  };
}

export function TransactionForm({
  kind,
  products,
  contacts,
  draft,
}: {
  kind: TransactionKind;
  products: TransactionProduct[];
  /** The shop's contacts, suggested in the name field. */
  contacts: Choice<number>[];
  /** What was filled in on the other form before switching to this one. */
  draft: TransactionDraft | null;
}) {
  const router = useRouter();
  const at = useShopPath();
  const [state, action, pending] = useActionState<TransactionState, FormData>(recordTransaction, null);
  const sale = kind === "vente";
  const submitLabel = sale ? "Confirmer la vente" : "Confirmer l'achat";
  const [lines, setLines] = useState<Line[]>(() => draftLines(draft, products));
  const nextKey = useRef(lines.length);
  // One seller for the whole purchase: their group applies to every line that has a price for it.
  const [group, setGroup] = useState<number | null>(draft?.privileged ?? null);
  const [counterparty, setCounterparty] = useState(draft?.counterparty ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [tillPending, setTillPending] = useState(draft?.tillPending ?? false);
  const evaluated = lines.map((line) => evaluate(line, kind, products, group));
  const total = evaluated.reduce((sum, e) => sum + e.value, 0);
  // The purchase's products that have privileged prices, once each, and their groups in the groups' order.
  const privilegedProducts = sale
    ? []
    : evaluated.flatMap((e) => (e.product && e.product.privileged.length > 0 ? [e.product] : []));
  const uniquePrivileged = privilegedProducts.filter((p, i) => privilegedProducts.indexOf(p) === i);
  const groups = uniquePrivileged
    .flatMap((p) => p.privileged)
    .filter((g, i, all) => all.findIndex((o) => o.groupId === g.groupId) === i)
    .sort((a, b) => a.groupId - b.groupId);
  // Once no line has a price for the chosen group, the choice goes back to the usual prices, for good.
  // A sale has no choice: it keeps it for a switch back to the purchase.
  if (!sale && group != null && !groups.some((g) => g.groupId === group)) setGroup(null);

  // A product sold on several lines is checked against its stock for all of them.
  // Selling more than the stock is allowed: the member is warned, the stock stops at zero.
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

  /** Opens the other form with everything filled in so far. */
  function switchKind() {
    const carried: TransactionDraft = {
      lines: lines.map((l, i) => ({
        productId: l.productId,
        quantity: l.quantity,
        label: l.label,
        // Only an amount the member typed; a tariff amount is recomputed with the other side's tariff.
        amount: (l.manual || evaluated[i].suggested == null) && l.amount ? l.amount : null,
      })),
      counterparty,
      notes,
      tillPending,
      privileged: group,
    };
    const params = new URLSearchParams({ [DRAFT_PARAM]: encodeDraft(carried) });
    router.push(at(`/achat-vente/${sale ? "achat" : "vente"}?${params}`));
  }

  const form = (
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
              <div className="tx-line-row">
                <div className="field tx-product">
                  <label htmlFor={`${id}-product`}>Marchandise</label>
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
                      En stock :{" "}
                      <strong className={`tx-figure${short.includes(e.product) ? " stock-short" : ""}`}>
                        {e.product.stock} {plural(e.product.unit, e.product.stock)}
                        {short.includes(e.product) && (
                          <TriangleAlert
                            size={14}
                            role="img"
                            aria-label="Stock insuffisant : la vente passera quand même, et le stock descendra à 0"
                          >
                            <title>Stock insuffisant : la vente passera quand même, et le stock descendra à 0</title>
                          </TriangleAlert>
                        )}
                      </strong>
                    </span>
                  )}
                  {e.product && (
                    <span className="small muted" data-testid="prix-par-defaut">
                      Prix par défaut :{" "}
                      {e.unitPrice ? (
                        <>
                          <strong className="tx-figure">{rate(e.unitPrice.price, e.unitPrice.qty)}</strong>
                          {e.unitPrice.bulk ? " (prix de gros)" : ""}
                          {e.unitPrice.privileged ? ` (prix privilégié : ${e.unitPrice.privileged})` : ""}
                        </>
                      ) : (
                        "aucun tarif"
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
                <div className="field tx-amount">
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
                      {e.privileged ? ` (prix privilégié : ${e.privileged.name})` : ""}
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
              {line.productId === OTHER ? (
                <div className="field">
                  <label htmlFor={`${id}-label`}>Nom de l&apos;article</label>
                  <input
                    id={`${id}-label`}
                    name="label"
                    required
                    maxLength={100}
                    value={line.label}
                    onChange={(ev) => update(line.key, { label: ev.target.value })}
                  />
                </div>
              ) : (
                // Keeps the fields of every line aligned in the submitted form.
                <input type="hidden" name="label" value="" />
              )}
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
        <p className="tx-total" data-testid="total" aria-live="polite">
          {sale ? "Total de la vente" : "Total de l'achat"} : <strong>{septims(total)}</strong>
        </p>
      </div>
      <div className="tx-grid">
        {groups.length > 0 && (
          <fieldset className="field full privileged-choice">
            <legend>Prix privilégié du vendeur</legend>
            <div className="privileged-options">
              <label className="check">
                <input
                  type="radio"
                  name="privilegedGroup"
                  value=""
                  checked={group == null}
                  onChange={() => setGroup(null)}
                />{" "}
                Aucun
              </label>
              {groups.map((g) => (
                <label key={g.groupId} className="check">
                  <input
                    type="radio"
                    name="privilegedGroup"
                    value={g.groupId}
                    checked={group === g.groupId}
                    onChange={() => setGroup(g.groupId)}
                  />{" "}
                  {g.name}
                </label>
              ))}
            </div>
            {uniquePrivileged.map((p) => (
              <span key={p.id} className="small muted">
                {uniquePrivileged.length > 1 && `${p.name} · `}
                {p.privileged.map((g) => `${g.name} : ${rate(g.price, p.buyQty)}`).join(" · ")}
                {p.buyPrice != null && ` · autres vendeurs : ${rate(p.buyPrice, p.buyQty)}`}
              </span>
            ))}
          </fieldset>
        )}
        <div className="field full">
          <label htmlFor="t-counterparty">Nom du client / vendeur RP (facultatif)</label>
          <Combobox
            free
            id="t-counterparty"
            name="counterparty"
            maxLength={100}
            choices={contacts}
            listLabel="Contacts"
            value={counterparty}
            onChange={setCounterparty}
          />
        </div>
        <div className="field full">
          <label htmlFor="t-notes">Notes (facultatif)</label>
          <textarea
            id="t-notes"
            name="notes"
            rows={3}
            maxLength={500}
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
          />
        </div>
        <div className="field full">
          <label className="check">
            <input
              type="checkbox"
              name="tillPending"
              checked={tillPending}
              onChange={(ev) => setTillPending(ev.target.checked)}
            />{" "}
            {sale
              ? "Pas encore mis en caisse"
              : "Pas encore sorti de la caisse"}
          </label>
          <span className="small muted">
            Tu pourras {sale ? "la" : "le"} valider plus tard depuis le registre.
          </span>
        </div>
      </div>
      {state && (
        <p className="notice error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        <Plus size={16} /> {submitLabel}
      </button>
    </form>
  );

  return (
    <>
      <p className="row-actions">
        <Link className="btn btn-small btn-ghost" href={at("/achat-vente")}>
          <ArrowLeft size={14} /> Retour au registre
        </Link>
        <button type="button" className="btn btn-small btn-ghost" onClick={switchKind}>
          <ArrowLeftRight size={14} /> {sale ? "C'est un achat" : "C'est une vente"}
        </button>
      </p>
      <section className="panel" style={{ maxWidth: 760 }} aria-label={sale ? "Inscrire une vente" : "Inscrire un achat"}>
        <div className="eyebrow">Nouvelle écriture</div>
        <h2>{sale ? "Inscrire une vente" : "Inscrire un achat"}</h2>
        {form}
      </section>
    </>
  );
}
