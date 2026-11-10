import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/page-head";
import { DeleteSupplierButton, OfferForm, SupplierForm } from "@/components/supplier-forms";
import { requireMember } from "@/lib/auth/session";
import { byName, getDb, schema } from "@/lib/db";
import { formatNumber, plural, septims } from "@/lib/pricing";
import { offersOf } from "@/lib/suppliers";
import { removeOffer } from "../actions";

export default async function EditSupplier({ params }: { params: Promise<{ id: string }> }) {
  await requireMember(["gerant"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const [[supplier], offers, products] = await Promise.all([
    db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).limit(1),
    offersOf([id]),
    db
      .select({ id: schema.products.id, name: schema.products.name, unit: schema.products.unit })
      .from(schema.products)
      .where(eq(schema.products.archived, false))
      .orderBy(byName(schema.products.name), asc(schema.products.id)),
  ]);
  if (!supplier) notFound();
  const offered = offers.get(id) ?? [];

  return (
    <>
      <PageHead title={supplier.name}>
        <Link href="/fournisseurs">← Fournisseurs</Link>
      </PageHead>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Fiche</div>
        <h2>Le fournisseur</h2>
        <SupplierForm supplier={supplier} />
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Ce qu&apos;il vend</div>
        <h2>Marchandises proposées</h2>
        {offered.length === 0 ? (
          <p className="muted">Aucune marchandise pour l&apos;instant.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Marchandise</th>
                  <th className="num">Prix</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offered.map((o) => (
                  <tr key={o.id}>
                    <td>{o.productName}</td>
                    <td className="num">
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
        )}
        <h3>Ajouter ou changer un prix</h3>
        <p className="small muted">Choisir une marchandise déjà proposée remplace son prix.</p>
        <OfferForm supplierId={id} products={products} />
      </section>

      <section className="panel" style={{ maxWidth: 760 }}>
        <div className="eyebrow">Attention</div>
        <h2>Supprimer</h2>
        <p className="muted">Le fournisseur et la liste de ce qu&apos;il propose disparaissent.</p>
        <DeleteSupplierButton id={id} name={supplier.name} />
      </section>
    </>
  );
}
