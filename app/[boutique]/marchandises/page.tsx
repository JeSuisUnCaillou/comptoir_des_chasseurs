import Link from "next/link";
import { X } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { pageParam, searchParam } from "@/lib/pagination";
import { LiveSearch } from "@/components/live-search";
import { ProductForm } from "@/components/product-form";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { CATEGORY_LABELS, rate, septims } from "@/lib/pricing";
import { activeProducts, blacksmithLeatherPrice, featuredProducts, productPage } from "@/lib/products";
import { saveBlacksmithPrice, saveFeatured } from "./actions";

type Search = { q?: string | string[]; page?: string | string[] };

export default async function Marchandises({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember(["gerant"]);
  const at = (path: string) => shopPath(member.shop.slug, path);
  const search = await searchParams;
  const q = searchParam(search.q);
  const page = pageParam(search.page);
  const [{ products, total }, blacksmith, active] = await Promise.all([
    productPage(member.shopId, q, page),
    blacksmithLeatherPrice(member.shopId),
    activeProducts(member.shopId),
  ]);
  const featured = featuredProducts(active);
  const others = active.filter((p) => p.featuredAt == null);

  return (
    <>
      <PageHead title="Gérer les marchandises">
        La liste des marchandises de la boutique et leurs prix.
      </PageHead>

      <div className="cols section-gap">
        <section className="panel" aria-labelledby="ajout">
          <div className="eyebrow">Nouvelle référence</div>
          <h2 id="ajout">Ajouter une marchandise</h2>
          <ProductForm />
        </section>
        <div className="panel-stack">
          <section className="panel" aria-labelledby="phare">
            <div className="eyebrow">Réglage</div>
            <h2 id="phare">Produits phares</h2>
            <p className="muted">
              Mis en avant en haut des Tarifs, dans cet ordre ; le premier est choisi d&apos;office dans le
              calculateur.
            </p>
            {featured.length === 0 ? (
              <p className="muted">Aucun produit phare.</p>
            ) : (
              <ul className="featured-list" aria-label="Produits phares actuels">
                {featured.map((p) => (
                  <li key={p.id}>
                    <span>{p.name}</span>
                    <form action={saveFeatured}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button className="icon-btn" type="submit" title={`Retirer ${p.name}`} aria-label={`Retirer ${p.name}`}>
                        <X size={16} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {others.length > 0 && (
              <form action={saveFeatured} className="inline-form">
                <input type="hidden" name="featured" value="1" />
                <select name="productId" aria-label="Produit phare à ajouter" required defaultValue="">
                  <option value="" disabled>
                    Choisir une marchandise
                  </option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-small" type="submit">
                  Ajouter
                </button>
              </form>
            )}
          </section>
          <section className="panel" aria-labelledby="forgeron">
            <div className="eyebrow">Réglage</div>
            <h2 id="forgeron">Rachat du cuir par le forgeron</h2>
            <p className="muted">
              Sert à calculer le bénéfice sur les peaux. Prix actuel : {septims(blacksmith)}.
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
      </div>

      <section className="panel">
        <div className="eyebrow">Catalogue</div>
        <h2>Toutes les marchandises</h2>
        <LiveSearch />
        {products.length === 0 && <p className="muted">Aucune marchandise ne correspond.</p>}
        <div className="table-wrap">
          <table className="stack-cards">
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
                  <td className="stack-title">
                    <strong>{p.name}</strong> {p.archived && <span className="badge">Archivée</span>}
                  </td>
                  <td data-label="Catégorie">{CATEGORY_LABELS[p.category]}</td>
                  <td className="num" data-label="Rachat">{p.buyPrice == null ? "—" : rate(p.buyPrice, p.buyQty)}</td>
                  <td className="num" data-label="Vente">{p.sellPrice == null ? "—" : rate(p.sellPrice, p.sellQty)}</td>
                  <td className="stack-aside">
                    <Link className="btn btn-small" href={at(`/marchandises/${p.id}`)} aria-label={`Modifier ${p.name}`}>
                      Modifier
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} path={at("/marchandises")} params={{ q: q || undefined }} label="Pages des marchandises" />
      </section>
    </>
  );
}
