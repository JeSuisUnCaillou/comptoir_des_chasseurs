import { asc } from "drizzle-orm";
import Link from "next/link";
import { PageHead } from "@/components/page-head";
import { ProductForm } from "@/components/product-form";
import { requireMember } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { CATEGORY_LABELS, rate, septims } from "@/lib/pricing";
import { blacksmithLeatherPrice } from "@/lib/products";
import { saveBlacksmithPrice } from "./actions";

export default async function Marchandises() {
  await requireMember(["gerant"]);
  const [products, blacksmith] = await Promise.all([
    getDb()
      .select()
      .from(schema.products)
      .orderBy(asc(schema.products.archived), asc(schema.products.category), asc(schema.products.name)),
    blacksmithLeatherPrice(),
  ]);

  return (
    <>
      <PageHead eyebrow="Registres · Gérance" title="Marchandises">
        La liste des marchandises du comptoir et leurs prix.
      </PageHead>

      <section className="panel">
        <div className="eyebrow">Catalogue</div>
        <h2>Toutes les marchandises</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th className="num">Rachat</th>
                <th className="num">Vente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className={p.archived ? "muted" : undefined}>
                  <td>
                    <strong>{p.name}</strong> {p.archived && <span className="badge">Archivée</span>}
                  </td>
                  <td>{CATEGORY_LABELS[p.category]}</td>
                  <td className="num">{p.buyPrice == null ? "—" : rate(p.buyPrice, p.buyQty)}</td>
                  <td className="num">{p.sellPrice == null ? "—" : rate(p.sellPrice, p.sellQty)}</td>
                  <td>
                    <Link className="btn btn-small" href={`/marchandises/${p.id}`} aria-label={`Modifier ${p.name}`}>
                      Modifier
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="cols">
        <section className="panel" aria-labelledby="ajout">
          <div className="eyebrow">Nouvelle référence</div>
          <h2 id="ajout">Ajouter une marchandise</h2>
          <ProductForm />
        </section>
        <section className="panel">
          <div className="eyebrow">Réglage</div>
          <h2>Rachat du cuir par le forgeron</h2>
          <p className="muted">
            Sert au calcul du bénéfice par lot de peaux. Actuellement : {septims(blacksmith)}.
          </p>
          <form action={saveBlacksmithPrice} className="inline-form">
            <input
              name="value"
              type="number"
              min={0}
              defaultValue={blacksmith}
              aria-label="Prix du cuir chez le forgeron"
            />
            <button className="btn btn-small" type="submit">
              Enregistrer
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
