import { MapPin } from "lucide-react";
import Link from "next/link";
import type { OfferSide } from "@/lib/db/schema";
import type { SupplierOfferRow, SupplierWithOffers } from "@/lib/suppliers";
import { formatNumber, plural, septims } from "@/lib/pricing";

/** What a contact is to the shop, from the way their merchandise goes. */
export function contactKind(offers: Pick<SupplierOfferRow, "side">[]) {
  const sells = offers.some((o) => o.side === "sells");
  const buys = offers.some((o) => o.side === "buys");
  if (sells && buys) return "Fournisseur et client";
  if (sells) return "Fournisseur";
  if (buys) return "Client";
  return "Contact";
}

export const SIDE_TITLES: Record<OfferSide, string> = { sells: "Il nous vend", buys: "Il nous achète" };

function Offers({ title, offers }: { title: string; offers: SupplierOfferRow[] }) {
  if (offers.length === 0) return null;
  return (
    <>
      <h4 className="supplier-offers-title">{title}</h4>
      <ul className="supplier-offers" aria-label={title}>
        {offers.map((o) => (
          <li key={o.id}>
            <span>{o.productName}</span>
            <span className="supplier-price">
              <strong>{septims(o.price)}</strong>
              <span className="small muted">
                pour {formatNumber(o.qty)} {plural(o.unit, o.qty)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** A contact's card; `editHref` is the address of its form, for a gérant. */
export function SupplierCard({ supplier, editHref }: { supplier: SupplierWithOffers; editHref?: string }) {
  const { offers } = supplier;
  return (
    <article className="supplier-card" aria-label={supplier.name}>
      <div className="supplier-card-head">
        <div className="eyebrow">{contactKind(offers)}</div>
        {editHref && (
          <Link className="btn btn-small btn-ghost" href={editHref} aria-label={`Modifier ${supplier.name}`}>
            Modifier
          </Link>
        )}
      </div>
      <h3>{supplier.name}</h3>
      {supplier.place && (
        <p className="supplier-place">
          <MapPin size={15} aria-hidden /> {supplier.place}
        </p>
      )}
      {supplier.notes && <p className="supplier-notes">{supplier.notes}</p>}
      {offers.length === 0 ? (
        <p className="small muted">Aucune marchandise pour l&apos;instant.</p>
      ) : (
        <>
          <Offers title={SIDE_TITLES.sells} offers={offers.filter((o) => o.side === "sells")} />
          <Offers title={SIDE_TITLES.buys} offers={offers.filter((o) => o.side === "buys")} />
        </>
      )}
    </article>
  );
}
