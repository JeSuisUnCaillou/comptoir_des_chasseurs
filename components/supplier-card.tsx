import { MapPin } from "lucide-react";
import Link from "next/link";
import { CONTACT_KIND_LABELS, contactKind } from "@/lib/contact-kind";
import type { OfferSide } from "@/lib/db/schema";
import type { SupplierOfferRow, SupplierWithOffers } from "@/lib/suppliers";
import { formatNumber, plural, septims } from "@/lib/pricing";

export const SIDE_TITLES: Record<OfferSide, string> = { sells: "Il nous vend", buys: "Il nous achète" };

function Offers({ side, offers }: { side: OfferSide; offers: SupplierOfferRow[] }) {
  const title = SIDE_TITLES[side];
  if (offers.length === 0) return null;
  return (
    <>
      <h4 className={`supplier-offers-title supplier-offers-${side}`}>{title}</h4>
      <ul className={`supplier-offers supplier-offers-${side}`} aria-label={title}>
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
  const kind = contactKind(offers);
  return (
    // Each kind has its own colours (globals.css): gold suppliers, blue customers.
    <article className={`supplier-card supplier-card-${kind}`} aria-label={supplier.name}>
      <div className="supplier-card-head">
        <div className="eyebrow">{CONTACT_KIND_LABELS[kind]}</div>
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
          <Offers side="sells" offers={offers.filter((o) => o.side === "sells")} />
          <Offers side="buys" offers={offers.filter((o) => o.side === "buys")} />
        </>
      )}
    </article>
  );
}
