"use server";

import { redirect } from "next/navigation";
import { shopPath } from "@/lib/paths";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import {
  deleteContract as remove,
  removeContractLine as unask,
  saveContract as save,
  saveContractLine as ask,
  setDelivered,
} from "@/lib/contracts";
import { optionalDay } from "@/lib/dates";
import { attempt } from "@/lib/errors";
import { CONTRACT_CLIENT_MAX, CONTRACT_NAME_MAX, QUANTITY_ERROR, isQuantity, optionalId, text } from "@/lib/forms";

// `at` changes on every success, so a form can clear itself by key.
export type ContractFormState = { ok: boolean; message: string; at?: number } | null;

/** Writes a new contract, or changes the one the form carries the id of. */
export async function saveContract(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  const dueOn = optionalDay(text(formData, "dueOn", 10));
  const values = {
    name: text(formData, "name", CONTRACT_NAME_MAX),
    client: text(formData, "client", CONTRACT_CLIENT_MAX),
    dueOn: dueOn ?? null,
  };
  if (Number.isNaN(id)) return { ok: false, message: "Contrat inconnu." };
  if (!values.name) return { ok: false, message: "Donne un nom au contrat." };
  if (dueOn === undefined) return { ok: false, message: "L'échéance n'est pas une date." };

  const result = await attempt(() => save(member, id, values));
  if (!result.ok) return result;
  revalidateShop();
  // A new contract goes straight to its page, to say what it asks for.
  if (id == null) redirect(shopPath(member.shop.slug, `/contrats/${result.value}`));
  return { ok: true, message: "Contrat enregistré." };
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
  await unask(member.shopId, contractId, lineId);
  revalidateShop();
}

/** Marks a contract delivered (it goes under « Contrats livrés »), or opens it again. */
export async function markDelivered(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  if (!id) return;
  const delivered = formData.get("delivered") === "true";
  await setDelivered(member.shopId, id, delivered);
  revalidateShop();
  redirect(shopPath(member.shop.slug, delivered ? "/contrats" : `/contrats/${id}`));
}

export async function deleteContract(formData: FormData) {
  const member = await requireMember(["gerant"]);
  const id = optionalId(formData);
  if (id) await remove(member.shopId, id);
  revalidateShop();
  redirect(shopPath(member.shop.slug, "/contrats"));
}
