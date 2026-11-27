"use client";

import { useActionState } from "react";
import {
  deleteContract,
  saveContract,
  saveContractLine,
  type ContractFormState,
} from "@/app/[boutique]/contrats/actions";
import { keepValues } from "@/components/keep-values";
import { ProductField } from "@/components/product-field";
import { CONTRACT_CLIENT_MAX, CONTRACT_NAME_MAX } from "@/lib/contract-progress";

function Status({ state }: { state: ContractFormState }) {
  if (!state) return null;
  return (
    <p className={`small ${state.ok ? "plus" : "minus"}`} role={state.ok ? "status" : "alert"} style={{ margin: "6px 0 0" }}>
      {state.message}
    </p>
  );
}

export function ContractForm({
  contract,
}: {
  contract?: { id: number; name: string; client: string; dueOn: string | null };
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
      </div>
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
  products: { id: number; name: string; unit: string; aliases?: readonly string[] }[];
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
            products={products.map((p) => ({ id: p.id, name: `${p.name} (${p.unit})`, aliases: p.aliases }))}
          />
        </div>
        <div className="field">
          <label htmlFor="l-quantity">Quantité demandée</label>
          <input id="l-quantity" name="quantity" type="number" min={1} max={1_000_000} step={1} required />
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
