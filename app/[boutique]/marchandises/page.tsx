import Link from "next/link";
import { FeaturedList } from "@/components/featured-list";
import { ProductField } from "@/components/product-field";
import { PageHead } from "@/components/page-head";
import { Pagination } from "@/components/pagination";
import { pageParam, searchParam } from "@/lib/pagination";
import { LiveSearch } from "@/components/live-search";
import { ProductForm } from "@/components/product-form";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
import { rate, septims } from "@/lib/pricing";
import { MAX_PRIVILEGED_GROUPS, privilegedGroups } from "@/lib/privileged-groups";
import { CategoryManager } from "@/components/category-manager";
import { shopCategories } from "@/lib/categories";
import { activeProducts, blacksmithLeatherPrice, featuredProducts, productPage } from "@/lib/products";
import { PrivilegedGroupsForm } from "@/components/privileged-groups-form";
import { saveBlacksmithPrice, saveFeatured } from "./actions";

type Search = { q?: string | string[]; page?: string | string[] };

export default async function Marchandises({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember(["gerant"]);
  const at = (path: string) => shopPath(member.shop.slug, path);
  const search = await searchParams;
  const q = searchParam(search.q);
  const page = pageParam(search.page);
  const [{ products, total }, blacksmith, active, privileged, categories] = await Promise.all([
    productPage(member.shopId, q, page),
    blacksmithLeatherPrice(member.shopId),
    activeProducts(member.shopId),
    privilegedGroups(member.shopId),
    shopCategories(member.shopId),
  ]);
  const groups = privileged.map(({ id, name }) => ({ id, name }));
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
          <ProductForm groups={groups} categories={categories} />
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
              <FeaturedList products={featured.map((p) => ({ id: p.id, name: p.name }))} />
            )}
            {others.length > 0 && (
              // A new form once a product is added, so the field starts empty again.
              <form action={saveFeatured} className="featured-add" key={featured.map((p) => p.id).join()}>
                <input type="hidden" name="featured" value="1" />
                <label htmlFor="phare-ajout">Ajouter un produit phare</label>
                <div className="inline-form">
                  <ProductField
                    id="phare-ajout"
                    name="productId"
                    required
                    products={others.map((p) => ({ id: p.id, name: p.name }))}
                  />
                  <button className="btn btn-small" type="submit">
                    Ajouter
                  </button>
                </div>
              </form>
            )}
          </section>
          <section className="panel" aria-labelledby="privilegies">
            <div className="eyebrow">Réglage</div>
            <h2 id="privilegies">Clients privilégiés</h2>
            <p className="muted">
              Chaque groupe de clients privilégiés a ses propres prix de rachat, à fixer sur chaque marchandise. Par
              exemple : les citoyens d&apos;une ville, les membres d&apos;une guilde, les Compagnons, les habitués.
            </p>
            <PrivilegedGroupsForm groups={groups} max={MAX_PRIVILEGED_GROUPS} />
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
          <section className="panel" aria-labelledby="categories">
            <div className="eyebrow">Réglage</div>
            <h2 id="categories">Catégories</h2>
            <p className="muted">
              Elles rangent les marchandises dans les Tarifs, l&apos;inventaire et les formulaires, dans cet ordre.
              Une catégorie se supprime une fois vide.
            </p>
            <CategoryManager categories={categories} />
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
                  <td data-label="Catégorie">{p.categoryName}</td>
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
