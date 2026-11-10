import { MapPin } from "lucide-react";
import Link from "next/link";
import type { SupplierWithOffers } from "@/lib/suppliers";
import { formatNumber, plural, septims } from "@/lib/pricing";

export function SupplierCard({ supplier, editable }: { supplier: SupplierWithOffers; editable: boolean }) {
  return (
    <article className="supplier-card" aria-label={supplier.name}>
      <div className="supplier-card-head">
        <div className="eyebrow">Fournisseur</div>
        {editable && (
          <Link className="btn btn-small btn-ghost" href={`/fournisseurs/${supplier.id}`} aria-label={`Modifier ${supplier.name}`}>
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
      <h4 className="supplier-offers-title">Marchandises proposées</h4>
      {supplier.offers.length === 0 ? (
        <p className="small muted">Aucune marchandise pour l&apos;instant.</p>
      ) : (
        <ul className="supplier-offers">
          {supplier.offers.map((o) => (
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
      )}
    </article>
  );
}
