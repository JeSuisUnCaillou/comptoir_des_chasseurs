"use server";

import { redirect } from "next/navigation";
import { shopPath } from "@/lib/paths";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import {
  createContract as create,
  deleteContract as remove,
  removeContractLine as unask,
  saveContract as save,
  saveContractLine as ask,
  cancelDelivery as undeliver,
  deliverContract,
  receivePayment as receive,
} from "@/lib/contracts";
import { optionalDay } from "@/lib/dates";
import { attempt } from "@/lib/errors";
import {
  CONTRACT_CLIENT_MAX,
  CONTRACT_LINES_MAX,
  CONTRACT_NAME_MAX,
  CONTRACT_PRICE_MAX,
  QUANTITY_ERROR,
  isQuantity,
  optionalId,
  optionalInt,
  text,
} from "@/lib/forms";

// `at` changes on every success, so a form can clear itself by key.
export type ContractFormState = { ok: boolean; message: string; at?: number } | null;

/**
 * The merchandises a new contract asks for: one productId and one quantity
 * field per line, in order; or the message saying what is wrong with them.
 */
function readLines(formData: FormData) {
  const products = formData.getAll("productId").map((v) => Number(v));
  const quantities = formData.getAll("quantity").map((v) => Number(v));
  if (products.length !== quantities.length || products.length > CONTRACT_LINES_MAX) {
    return { error: `Un contrat demande au plus ${CONTRACT_LINES_MAX} marchandises.` };
  }
  if (products.some((p) => !Number.isInteger(p) || p < 1)) return { error: "Choisis une marchandise sur chaque ligne." };
  if (!quantities.every(isQuantity)) return { error: QUANTITY_ERROR };
  return { lines: products.map((productId, i) => ({ productId, quantity: quantities[i] })) };
}

/** Writes a new contract with its merchandises, or changes the one the form carries the id of. */
export async function saveContract(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  const dueOn = optionalDay(text(formData, "dueOn", 10));
  const price = optionalInt(formData, "price");
  const values = {
    name: text(formData, "name", CONTRACT_NAME_MAX),
    client: text(formData, "client", CONTRACT_CLIENT_MAX),
    dueOn: dueOn ?? null,
    price,
  };
  if (Number.isNaN(id)) return { ok: false, message: "Contrat inconnu." };
  if (!values.name) return { ok: false, message: "Donne un nom au contrat." };
  if (dueOn === undefined) return { ok: false, message: "L'échéance n'est pas une date." };
  if (Number.isNaN(price) || (price != null && price > CONTRACT_PRICE_MAX)) {
    return { ok: false, message: "Le prix doit être un nombre entier de septims (0 ou plus)." };
  }

  if (id != null) {
    const result = await attempt(() => save(member.shopId, id, values));
    if (!result.ok) return result;
    revalidateShop();
    return { ok: true, message: "Contrat enregistré." };
  }
  const { lines, error } = readLines(formData);
  if (!lines) return { ok: false, message: error };
  const result = await attempt(() => create(member, values, lines));
  if (!result.ok) return result;
  revalidateShop();
  // A new contract shows among the others, its merchandises against the stock.
  redirect(shopPath(member.shop.slug, "/contrats"));
}

/** Asks a merchandise in a contract, or changes how much of it. */
export async function saveContractLine(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const member = await requireMember(["gerant"]);
  const contractId = optionalId(formData, "contractId");
  const productId = optionalId(formData, "productId");
  const quantity = Number(formData.get("quantity"));
  if (!contractId || !productId) return { ok: false, message: "Choisis une marchandise." };
  if (!isQuantity(quantity)) return { ok: false, message: QUANTITY_ERROR };
  const result = await attempt(() => ask(member.shopId, { contractId, productId, quantity }));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "Marchandise enregistrée.", at: Date.now() };
}

export async function removeContractLine(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const lineId = optionalId(formData);
  const contractId = optionalId(formData, "contractId");
  if (!lineId || !contractId) return;
  // A delivered contract's merchandises don't change: its page shows no button for it.
  const result = await attempt(() => unask(member.shopId, contractId, lineId));
  if (result.ok) revalidateShop();
}

/**
 * The steps of a contract after it is written: deliver it (a sale whose
 * septims wait), say its septims are in, or undo its delivery.
 */
export async function contractStep(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  if (!id) return { ok: false, message: "Contrat inconnu." };
  const step = formData.get("step");
  const run =
    step === "livrer"
      ? () => deliverContract(member, id)
      : step === "payer"
        ? () => receive(member, id)
        : step === "annuler"
          ? () => undeliver(member, id)
          : null;
  if (!run) return { ok: false, message: "Étape inconnue." };
  const result = await attempt(run);
  if (!result.ok) return result;
  revalidateShop();
  redirect(shopPath(member.shop.slug, step === "annuler" ? `/contrats/${id}` : "/contrats"));
}

export async function deleteContract(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  if (id) await remove(member.shopId, id);
  revalidateShop();
  redirect(shopPath(member.shop.slug, "/contrats"));
}
