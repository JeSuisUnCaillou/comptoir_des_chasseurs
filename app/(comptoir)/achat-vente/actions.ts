"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { attempt } from "@/lib/errors";
import { checked, optionalText, text } from "@/lib/forms";
import { MAX_LINES, lineMessage } from "@/lib/transaction-kinds";
import { cancelLine, recordCashLine, recordLines, settleLine, type TransactionLine } from "@/lib/transactions";

export type TransactionState = { ok: boolean; message: string } | null;

function revalidate() {
  for (const path of ["/", "/achat-vente", "/achat-vente/vente", "/achat-vente/achat", "/achat-vente/caisse", "/inventaire", "/tarifs"]) revalidatePath(path);
  // Members' activity pages show register lines too.
  revalidatePath("/membres/[id]", "page");
}

/**
 * Records a sale or a purchase of one or more merchandises: one register line
 * each, sharing the client and the notes, written all together or not at all.
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
  const productIds = formData.getAll("productId").map(String);
  const labels = formData.getAll("label").map(String);
  const quantities = formData.getAll("quantity").map(Number);
  const amounts = formData.getAll("amount").map(Number);

  if (kind !== "vente" && kind !== "rachat") return { ok: false, message: "Opération inconnue." };
  const count = productIds.length;
  if (count === 0) return { ok: false, message: "Indique l'article ou la marchandise." };
  if (count > MAX_LINES) return { ok: false, message: `Pas plus de ${MAX_LINES} marchandises à la fois.` };
  if (labels.length !== count || quantities.length !== count || amounts.length !== count) {
    return { ok: false, message: "Formulaire incomplet, recharge la page." };
  }
  // With several lines, each message says which one is wrong.
  const at = (i: number, message: string) => lineMessage(count, i, message);

  const lines: TransactionLine[] = [];
  for (let i = 0; i < count; i++) {
    const raw = productIds[i];
    const productId = raw === "" || raw === "autre" ? null : Number(raw);
    const quantity = quantities[i];
    const amount = amounts[i];
    if (productId != null && !Number.isInteger(productId)) {
      return { ok: false, message: at(i, "Marchandise inconnue.") };
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, message: at(i, "La quantité doit être un nombre entier positif.") };
    }
    if (!Number.isInteger(amount) || amount < 0) {
      return { ok: false, message: at(i, "Le montant doit être un nombre entier de septims.") };
    }
    lines.push({ productId, quantity, amount, label: labels[i].trim().slice(0, 100) });
  }

  const result = await attempt(() => recordLines(member, { kind, counterparty, notes, tillPending, lines }));
  if (!result.ok) return result;
  revalidate();
  // Back to the register, which shows the new lines.
  redirect(`/achat-vente?inscrit=${result.value.join(",")}`);
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

  if (kind !== "entree" && kind !== "sortie") {
    return { ok: false, message: "Indique si l'argent entre ou sort de la caisse." };
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { ok: false, message: "Le montant doit être un nombre entier de septims, au moins 1." };
  }
  if (!label) return { ok: false, message: "Indique le motif du mouvement." };

  const id = await recordCashLine(member, { kind, label, amount, counterparty, notes });
  revalidate();
  redirect(`/achat-vente?inscrit=${id}`);
}

/**
 * The septims of a sale or buyback waiting for the till are now in it, or out
 * of it: every line of the same entry counts in the till from now on.
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
  revalidate();
  return { ok: true, message: "Les septims comptent dans la caisse." };
}

/** Cancels a line and puts the stock back. Gérants, or the member who wrote it. */
export async function cancelTransaction(
  _prev: TransactionState,
  formData: FormData,
): Promise<TransactionState> {
  const member = await requireMember();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "Ligne inconnue." };
  const result = await attempt(() => cancelLine(member, id));
  if (!result.ok) return result;
  revalidate();
  return { ok: true, message: "Ligne annulée, stock rétabli." };
}
