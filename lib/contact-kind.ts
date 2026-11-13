import type { OfferSide } from "@/lib/db/schema";

export type ContactKind = "fournisseur" | "client" | "les-deux" | "contact";

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  fournisseur: "Fournisseur",
  client: "Client",
  "les-deux": "Fournisseur et client",
  contact: "Contact",
};

/** What a contact is to the shop, from the way their merchandise goes. Pure. */
export function contactKind(offers: { side: OfferSide }[]): ContactKind {
  const sells = offers.some((o) => o.side === "sells");
  const buys = offers.some((o) => o.side === "buys");
  if (sells && buys) return "les-deux";
  if (sells) return "fournisseur";
  if (buys) return "client";
  return "contact";
}
