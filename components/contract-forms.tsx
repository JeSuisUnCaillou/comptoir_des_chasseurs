"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  contractStep,
  deleteContract,
  saveContract,
  saveContractLine,
  type ContractFormState,
} from "@/app/[boutique]/contrats/actions";
import { keepValues } from "@/components/keep-values";
import { focusCombobox } from "@/components/combobox";
import { ProductCombobox } from "@/components/product-combobox";
import { ProductField } from "@/components/product-field";
import { CONTRACT_CLIENT_MAX, CONTRACT_LINES_MAX, CONTRACT_NAME_MAX, MAX_QUANTITY } from "@/lib/forms";

type ProductChoice = { id: number; name: string; unit: string; aliases?: readonly string[] };

/** "Biche (peau)": the unit tells which merchandise, as in the other contract forms. */
function withUnits(products: ProductChoice[]) {
  return products.map((p) => ({ id: p.id, name: `${p.name} (${p.unit})`, aliases: p.aliases }));
}

/**
 * The merchandises of a contract being written, one line each: picked from the
 * shop's merchandises, with the quantity asked. Sent as productId and quantity
 * fields, in order.
 */
function NewContractLines({ products }: { products: ProductChoice[] }) {
  const [lines, setLines] = useState<{ key: number; productId: number | null }[]>([{ key: 0, productId: null }]);
  const nextKey = useRef(1);
  const choices = withUnits(products);
  const add = () => {
    const key = nextKey.current++;
    setLines((all) => [...all, { key, productId: null }]);
    // Once the new line is drawn, the cursor waits in its merchandise.
    setTimeout(() => focusCombobox(`n-${key}-product`));
  };
  return (
    <div className="contract-new-lines">
      <h3>Marchandises demandées</h3>
      {lines.length === 0 && <p className="small muted">Aucune marchandise : tu pourras en ajouter depuis sa fiche.</p>}
      {lines.map((line, index) => {
        const id = `n-${line.key}`;
        return (
          <fieldset key={line.key} className="tx-line" aria-label={`Marchandise ${index + 1}`}>
            <div className="contract-new-line">
              <div className="field">
                <label htmlFor={`${id}-product`}>Marchandise</label>
                <ProductCombobox
                  id={`${id}-product`}
                  name="productId"
                  required
                  placeholder="Choisir ou taper un nom…"
                  products={choices}
                  value={line.productId}
                  onChange={(productId) =>
                    setLines((all) => all.map((l) => (l.key === line.key ? { ...l, productId } : l)))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`${id}-quantity`}>Quantité demandée</label>
                <input id={`${id}-quantity`} name="quantity" type="number" min={1} max={MAX_QUANTITY} step={1} required />
              </div>
              <button
                type="button"
                className="icon-btn tx-remove"
                title="Retirer cette marchandise"
                aria-label={`Retirer la marchandise ${index + 1}`}
                onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </fieldset>
        );
      })}
      <button
        type="button"
        className="btn btn-small contract-add-line"
        disabled={lines.length >= CONTRACT_LINES_MAX}
        title={lines.length >= CONTRACT_LINES_MAX ? `${CONTRACT_LINES_MAX} marchandises au plus` : undefined}
        onClick={add}
      >
        <Plus size={14} /> Ajouter une marchandise
      </button>
    </div>
  );
}

function Status({ state }: { state: ContractFormState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "6px 0 0" }}>
      {state.message}
    </p>
  );
}

/** A contract's name, client and day; a new one (`products` given) also takes its merchandises. */
export function ContractForm({
  contract,
  products,
}: {
  contract?: { id: number; name: string; client: string; dueOn: string | null; price: number | null; delivered: boolean };
  products?: ProductChoice[];
}) {
  const [state, action, pending] = useActionState<ContractFormState, FormData>(saveContract, null);
  return (
    <form onSubmit={keepValues(action)} aria-label="Le contrat">
      {contract && <input type="hidden" name="id" value={contract.id} />}
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="c-name">Nom du contrat</label>
          <input
            id="c-name"
            name="name"
            required
            maxLength={CONTRACT_NAME_MAX}
            defaultValue={contract?.name}
            placeholder="ex. Commande de la semaine"
          />
        </div>
        <div className="field">
          <label htmlFor="c-client">Client</label>
          <input
            id="c-client"
            name="client"
            maxLength={CONTRACT_CLIENT_MAX}
            defaultValue={contract?.client}
            placeholder="ex. Jarl de Vendeaume"
          />
        </div>
        <div className="field">
          <label htmlFor="c-due">Échéance</label>
          <input id="c-due" name="dueOn" type="date" defaultValue={contract?.dueOn ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="c-price">Prix (septims)</label>
          <input
            id="c-price"
            name="price"
            type="number"
            min={0}
            step={1}
            defaultValue={contract?.price ?? ""}
            disabled={contract?.delivered}
            aria-describedby="c-price-help"
          />
          <span id="c-price-help" className="small muted">
            {contract?.delivered ? "Fixé par la livraison." : "Ce qu'on nous paiera à la livraison."}
          </span>
        </div>
      </div>
      {!contract && products && <NewContractLines products={products} />}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {contract ? "Enregistrer le contrat" : "Créer le contrat"}
      </button>
      <Status state={state} />
    </form>
  );
}

export function ContractLineForm({
  contractId,
  products,
}: {
  contractId: number;
  products: ProductChoice[];
}) {
  const [state, action, pending] = useActionState<ContractFormState, FormData>(saveContractLine, null);
  return (
    <form onSubmit={keepValues(action)} key={state?.ok ? state.at : "form"} aria-label="Demander une marchandise">
      <input type="hidden" name="contractId" value={contractId} />
      <div className="form-grid">
        <div className="field span-2">
          <label htmlFor="l-product">Marchandise</label>
          <ProductField
            id="l-product"
            name="productId"
            required
            products={withUnits(products)}
          />
        </div>
        <div className="field">
          <label htmlFor="l-quantity">Quantité demandée</label>
          <input id="l-quantity" name="quantity" type="number" min={1} max={MAX_QUANTITY} step={1} required />
        </div>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        Enregistrer la marchandise
      </button>
      <Status state={state} />
    </form>
  );
}

export function DeleteContractButton({ id, name }: { id: number; name: string }) {
  return (
    <form action={deleteContract}>
      <input type="hidden" name="id" value={id} />
      <button
        className="btn btn-small minus"
        type="submit"
        onClick={(e) => {
          if (!window.confirm(`Supprimer le contrat ${name} ?`)) e.preventDefault();
        }}
      >
        Supprimer le contrat
      </button>
    </form>
  );
}

/**
 * One step of a contract after it is written (`step`: livrer, payer, annuler),
 * with the message saying why it was refused. `confirm` asks first.
 */
export function ContractStepButton({
  id,
  step,
  label,
  confirm,
  primary,
}: {
  id: number;
  step: "livrer" | "payer" | "annuler";
  label: string;
  confirm?: string;
  primary?: boolean;
}) {
  const [state, action, pending] = useActionState<ContractFormState, FormData>(contractStep, null);
  return (
    <form
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
          return;
        }
        keepValues(action)(e);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value={step} />
      <button className={`btn${primary ? " btn-primary" : ""}`} type="submit" disabled={pending}>
        {label}
      </button>
      <Status state={state} />
    </form>
  );
}
