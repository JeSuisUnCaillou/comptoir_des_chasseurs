"use server";

import { redirect } from "next/navigation";
import { shopPath } from "@/lib/paths";
import { safeReturnPath } from "@/lib/auth/return-path";
import { revalidateShop } from "../revalidate";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { QUANTITY_ERROR, checked, isQuantity, optionalText, productIdentity, text } from "@/lib/forms";
import { MAX_LINES, NEW_MERCHANDISE, OTHER_ARTICLE, lineMessage } from "@/lib/transaction-kinds";
import {
  cancelLines,
  editAmounts,
  markStockDeposited,
  recordCashLine,
  recordLines,
  restoreLines,
  settleAllOf,
  settleLine,
  type TransactionLine,
} from "@/lib/transactions";

export type TransactionState = { ok: boolean; message: string } | null;

/**
 * Records a sale or a purchase of one or more merchandises: one register line
 * each, sharing the client and the notes, written all together or not at all.
 * A purchase line may create its merchandise (`categoryId` and `unit`, empty
 * on the other lines).
 */
export async function recordTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const kind = formData.get("kind");
  const counterparty = optionalText(formData, "counterparty", 100);
  const notes = optionalText(formData, "notes", 500);
  const tillPending = checked(formData, "tillPending");
  const stockReminder = checked(formData, "stockReminder");
  const productIds = formData.getAll("productId").map(String);
  const labels = formData.getAll("label").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const amounts = formData.getAll("amount").map(Number);
  const categoryIds = formData.getAll("categoryId");
  const units = formData.getAll("unit");

  if (kind !== "vente" && kind !== "rachat") return { ok: false, message: "Opération inconnue." };
  const count = productIds.length;
  if (count === 0) return { ok: false, message: "Choisis une marchandise." };
  if (count > MAX_LINES) return { ok: false, message: `Pas plus de ${MAX_LINES} marchandises à la fois.` };
  if ([labels, quantities, amounts, categoryIds, units].some((field) => field.length !== count)) {
    return { ok: false, message: "Formulaire incomplet, recharge la page." };
  }
  // With several lines, each message says which one is wrong.
  const at = (i: number, message: string) => lineMessage(count, i, message);

  const lines: TransactionLine[] = [];
  for (let i = 0; i < count; i++) {
    const raw = productIds[i];
    const creating = raw === NEW_MERCHANDISE;
    const productId = raw === "" || raw === OTHER_ARTICLE || creating ? null : Number(raw);
    const quantity = quantities[i];
    const amount = amounts[i];
    const label = labels[i].trim().slice(0, 100);
    if (productId != null && !Number.isInteger(productId)) {
      return { ok: false, message: at(i, "Marchandise inconnue.") };
    }
    if (!isQuantity(quantity)) {
      return { ok: false, message: at(i, QUANTITY_ERROR) };
    }
    if (!Number.isInteger(amount) || amount < 0) {
      return { ok: false, message: at(i, "Le montant doit être un nombre entier de septims.") };
    }
    let newProduct;
    if (creating) {
      // Read like the Inventaire's « Nouvelle marchandise »; the service refuses it on a sale.
      const { error, ...identity } = productIdentity(label, categoryIds[i], units[i]);
      if (error) return { ok: false, message: at(i, error) };
      newProduct = identity;
    }
    lines.push({ productId, newProduct, quantity, amount, label });
  }

  const result = await attempt(() => recordLines(member, { kind, counterparty, notes, tillPending, stockReminder, lines }));
  if (!result.ok) return result;
  revalidateShop();
  // Back to the register, which shows the new lines.
  redirect(shopPath(member.shop.slug, `/achat-vente?inscrit=${result.value.join(",")}`));
}

/** Money in or out of the till alone, with no merchandise: wages, the gérant's deposits... */
export async function recordCashMovement(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const kind = formData.get("kind");
  const amount = Number(formData.get("amount"));
  const label = text(formData, "label", 100);
  const counterparty = optionalText(formData, "counterparty", 100);
  const notes = optionalText(formData, "notes", 500);
  const tillPending = checked(formData, "tillPending");

  if (kind !== "entree" && kind !== "sortie") {
    return { ok: false, message: "Indique si l'argent entre ou sort de la caisse." };
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, message: "Le montant doit être un nombre entier d'au moins 1 septim." };
  }
  if (!label) return { ok: false, message: "Précise la raison." };

  const id = await recordCashLine(member, { kind, label, amount, counterparty, notes, tillPending });
  revalidateShop();
  redirect(shopPath(member.shop.slug, `/achat-vente?inscrit=${id}`));
}

/**
 * The septims of a sale, buyback or cash movement waiting for the till are now
 * in it, or out of it: every line of the same entry counts in the till from now on.
 * Gérants, or the member who wrote it.
 */
export async function settleTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Ligne inconnue." };
  const result = await attempt(() => settleLine(member, id));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "C'est noté, la caisse est à jour." };
}

/**
 * Every line the member wrote that waits for the till is now in it or out of
 * it, provided the net is still the one they confirmed (`net`).
 */
export async function settleAll(_prev: TransactionState, formData: FormData): Promise<TransactionState> {
  const member = await requireMember();
  const net = Number(formData.get("net"));
  if (!Number.isInteger(net)) return { ok: false, message: "Total inconnu." };
  const result = await attempt(() => settleAllOf(member, net));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "C'est noté, la caisse est à jour." };
}

/** The merchandise of a purchase is in the chest: its reminder goes. Gérants, or the member who wrote it. */
export async function depositStock(_prev: TransactionState, formData: FormData): Promise<TransactionState> {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Ligne inconnue." };
  const result = await attempt(() => markStockDeposited(member, id));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "C'est noté." };
}

/**
 * Cancels a line and puts the stock back, or every line of its entry when
 * the form says `entier`. Gérants, or the member who wrote it.
 */
export async function cancelTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Ligne inconnue." };
  const result = await attempt(() => cancelLines(member, id, formData.get("entier") === "1"));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "Annulé, stock rétabli." };
}

/**
 * Counts a cancelled line again, or every cancelled line of its entry when
 * the form says `entier`. Gérants, or the member who wrote it.
 */
export async function restoreTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Ligne inconnue." };
  const result = await attempt(() => restoreLines(member, id, formData.get("entier") === "1"));
  if (!result.ok) return result;
  revalidateShop();
  return { ok: true, message: "Rétabli." };
}

/**
 * Changes the septims of the lines of an entry, the stock left as it is, then
 * goes back to the register. Gérants, or the member who wrote it.
 */
export async function editEntry(_prev: TransactionState, formData: FormData): Promise<TransactionState> {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  const lineIds = formData.getAll("lineId").map(Number);
  const amounts = formData.getAll("amount").map((a) => (String(a).trim() === "" ? NaN : Number(a)));
  if (!Number.isInteger(id) || lineIds.length === 0 || lineIds.length !== amounts.length) {
    return { ok: false, message: "Formulaire incomplet, recharge la page." };
  }
  if (lineIds.some((lineId) => !Number.isInteger(lineId))) return { ok: false, message: "Ligne inconnue." };
  // The service says which septims a line accepts.
  const result = await attempt(() => editAmounts(member, id, new Map(lineIds.map((lineId, i) => [lineId, amounts[i]]))));
  if (!result.ok) return result;
  revalidateShop();
  const retour = formData.get("retour");
  redirect(retour ? safeReturnPath(retour) : shopPath(member.shop.slug, `/achat-vente?modifie=${id}`));
}
