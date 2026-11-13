import { MAX_LINES } from "@/lib/transaction-kinds";

/**
 * What a member has filled in on Nouvel achat or Nouvelle vente, carried to
 * the other form when they switch between the two. Lives in the `reprise`
 * search param, so the other page renders already filled in.
 */
export type TransactionDraft = {
  lines: DraftLine[];
  counterparty: string;
  notes: string;
  tillPending: boolean;
  /** The seller's privileged group, by id, or null for the usual prices. */
  privileged: number | null;
};

export type DraftLine = {
  productId: string;
  quantity: string;
  label: string;
  /** Only an amount the member typed with the pencil; a tariff amount is recomputed on the other side. */
  amount: string | null;
};

export const DRAFT_PARAM = "reprise";

export function encodeDraft(draft: TransactionDraft) {
  return JSON.stringify(draft);
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

/** Reads a draft from the URL, or null when it is missing or not one. */
export function decodeDraft(raw: string | string[] | undefined): TransactionDraft | null {
  if (typeof raw !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.lines)) return null;
  const lines = d.lines.slice(0, MAX_LINES).flatMap((value): DraftLine[] => {
    if (!value || typeof value !== "object") return [];
    const l = value as Record<string, unknown>;
    return [
      {
        productId: text(l.productId, 20),
        quantity: text(l.quantity, 10),
        label: text(l.label, 100),
        amount: typeof l.amount === "string" ? l.amount.slice(0, 10) : null,
      },
    ];
  });
  if (lines.length === 0) return null;
  return {
    lines,
    counterparty: text(d.counterparty, 100),
    notes: text(d.notes, 500),
    tillPending: d.tillPending === true,
    privileged: Number.isSafeInteger(d.privileged) && (d.privileged as number) > 0 ? (d.privileged as number) : null,
  };
}
