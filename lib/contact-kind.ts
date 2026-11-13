import type { OfferSide } from "@/lib/db/schema";

/** What a contact is to the shop, from the way their merchandise goes. Pure. */
export function contactKind(offers: { side: OfferSide }[]) {
  const sells = offers.some((o) => o.side === "sells");
  const buys = offers.some((o) => o.side === "buys");
  if (sells && buys) return "Fournisseur et client";
  if (sells) return "Fournisseur";
  if (buys) return "Client";
  return "Contact";
}
