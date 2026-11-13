import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { SIDE_TITLES } from "@/components/supplier-card";
import { DeleteSupplierButton, OfferForm, SupplierForm } from "@/components/supplier-forms";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { activeProducts } from "@/lib/products";
import { formatNumber, plural, septims } from "@/lib/pricing";
import { offersOf, supplierOf } from "@/lib/suppliers";
import { removeOffer } from "../actions";

export default async function EditSupplier({ params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember(["gerant"]);
  const at = (path: string) => shopPath(member.shop.slug, path);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [supplier, offers, products] = await Promise.all([
    supplierOf(member.shopId, id),
    offersOf([id]),
    activeProducts(member.shopId),
  ]);
  if (!supplier) notFound();
  const offered = offers.get(id) ?? [];

  return (
    <>
      <PageHead title={supplier.name}>
        <Link href={at("/fournisseurs")}>← Contacts</Link>
      </PageHead>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Fiche</div>
        <h2>Le contact</h2>
        <SupplierForm supplier={supplier} />
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Ce qu&apos;il nous vend ou nous achète</div>
        <h2>Marchandises</h2>
        {offered.length === 0 && <p className="muted">Aucune marchandise pour l&apos;instant.</p>}
        {(["sells", "buys"] as const).map((side) => {
          const rows = offered.filter((o) => o.side === side);
          if (rows.length === 0) return null;
          return (
            <div key={side}>
              <h3>{SIDE_TITLES[side]}</h3>
              <div className="table-wrap">
                <table aria-label={SIDE_TITLES[side]}>
                  <thead>
                    <tr>
                      <th>Marchandise</th>
                      <th>Prix</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o) => (
                      <tr key={o.id}>
                        <td>{o.productName}</td>
                        <td>
                          {septims(o.price)} pour {formatNumber(o.qty)} {plural(o.unit, o.qty)}
                        </td>
                        <td>
                          <form action={removeOffer}>
                            <input type="hidden" name="id" value={o.id} />
                            <input type="hidden" name="supplierId" value={id} />
                            <button className="btn btn-small btn-ghost" type="submit" aria-label={`Retirer ${o.productName}`}>
                              Retirer
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        <h3>Ajouter ou changer un prix</h3>
        <p className="small muted">Choisir une marchandise déjà dans la liste remplace son prix et son sens.</p>
        <OfferForm supplierId={id} products={products} />
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Attention</div>
        <h2>Supprimer</h2>
        <p className="muted">Le contact et la liste de ce qu&apos;il vend ou achète disparaissent.</p>
        <DeleteSupplierButton id={id} name={supplier.name} />
      </section>
    </>
  );
}
