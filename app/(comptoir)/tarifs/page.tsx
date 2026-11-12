import Link from "next/link";
import type { ReactNode } from "react";
import { Eye, EyeOff, Pencil, Settings2, Tag } from "lucide-react";
import { LiveSearch } from "@/components/live-search";
import { PageHead } from "@/components/page-head";
import { PendingSpinner } from "@/components/nav-link";
import { PriceCalculator } from "@/components/price-calculator";
import { requireMember } from "@/lib/auth/session";
import { param, searchParam } from "@/lib/pagination";
import type { Product } from "@/lib/db/schema";
import {
  CATEGORY_LABELS,
  batchMargin,
  margin,
  rate,
  referenceQuantity,
  septims,
  formatNumber,
  plural,
} from "@/lib/pricing";
import { activeProducts, blacksmithLeatherPrice } from "@/lib/products";
import { isGerant } from "@/lib/policies";

function priced(p: Product) {
  return p.buyPrice != null || p.sellPrice != null;
}

const NO_MATCH = <p className="muted">Aucune marchandise ne correspond.</p>;

/** A gérant's pencil to the product's form in Gérer les tarifs, at the end of its row. */
function EditCell({ product, canEdit }: { product: Product; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <td className="row-action">
      <Link
        className="icon-btn"
        href={`/marchandises/${product.id}?depuis=tarifs`}
        title={`Modifier ${product.name}`}
        aria-label={`Modifier ${product.name}`}
      >
        <Pencil size={16} />
      </Link>
    </td>
  );
}

/** The citizens of Estemarche's buyback price, under the usual one, when the product has one. */
function CitizenPrice({ product, perUnit = false }: { product: Product; perUnit?: boolean }) {
  if (product.citizenBuyPrice == null) return null;
  return (
    <div className="citizen-price">
      <span className="badge badge-gold">
        Citoyens d&apos;Estemarche :{" "}
        <strong>{perUnit ? septims(product.citizenBuyPrice) : rate(product.citizenBuyPrice, product.buyQty)}</strong>
      </span>
    </div>
  );
}

function GoodsTable({ products, canEdit }: { products: Product[]; canEdit: boolean }) {
  return (
    <div className="table-wrap">
      <table className="stack-cards">
        <thead>
          <tr>
            <th>Marchandise</th>
            <th className="num">Rachat</th>
            <th className="num">Vente</th>
            <th className="num">Gros</th>
            <th className="num">Stock</th>
            <th className="num">Bénéfice brut indicatif</th>
            {canEdit && <th aria-label="Modifier" />}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const ref = referenceQuantity(p);
            const gross = margin(p, ref);
            return (
              <tr key={p.id}>
                <td className="stack-title">
                  <strong>{p.name}</strong>
                </td>
                <td className="num minus" data-label="Rachat">
                  {p.buyPrice == null ? "—" : rate(p.buyPrice, p.buyQty)}
                  <CitizenPrice product={p} />
                </td>
                <td className="num" data-label="Vente">{p.sellPrice == null ? "—" : rate(p.sellPrice, p.sellQty)}</td>
                <td className="num" data-label="Gros">
                  {p.bulkMin != null && p.bulkPrice != null
                    ? `Dès ${formatNumber(p.bulkMin)} : ${rate(p.bulkPrice, p.bulkQty)}`
                    : "—"}
                </td>
                <td className="num" data-label="Stock">
                  {formatNumber(p.stock)} {plural(p.unit, p.stock)}
                </td>
                <td className="num plus" data-label="Bénéfice brut indicatif">
                  {gross == null
                    ? "—"
                    : `${septims(gross, { signed: true })} pour ${formatNumber(ref)} unité${ref > 1 ? "s" : ""}`}
                </td>
                <EditCell product={p} canEdit={canEdit} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Search = { q?: string | string[]; "sans-tarif"?: string | string[] };

/** Below this many results for the search, priced or not, the products without a price show by themselves. */
const AUTO_UNPRICED_BELOW = 10;

/**
 * Under the grids, the button that shows or hides the products without a price,
 * keeping the search, and those products in a table of their own.
 * `auto`: a narrow search shows them without the button.
 */
function Unpriced({
  search,
  products,
  canEdit,
  auto,
}: {
  search: Search;
  products: Product[];
  canEdit: boolean;
  auto: boolean;
}) {
  if (auto && products.length === 0) return null;
  const shown = auto || param(search["sans-tarif"]) === "1";
  const query = new URLSearchParams();
  const q = param(search.q);
  if (q) query.set("q", q);
  if (!shown) query.set("sans-tarif", "1");
  const qs = query.toString();
  return (
    <div className="unpriced">
      {!auto && (
        <Link className="btn btn-small" href={qs ? `/tarifs?${qs}` : "/tarifs"} scroll={false}>
          {shown ? (
            <>
              <EyeOff size={14} /> Masquer les marchandises sans tarif
            </>
          ) : (
            <>
              <Eye size={14} /> Voir les marchandises sans tarif
            </>
          )}
          <PendingSpinner testId="sans-tarif-pending" />
        </Link>
      )}
      {shown &&
        (products.length === 0 ? (
          <p className="muted">Aucune marchandise sans tarif.</p>
        ) : (
          <div className="table-wrap">
            <table className="stack-cards" aria-label="Marchandises sans tarif">
              <thead>
                <tr>
                  <th>Marchandise sans tarif</th>
                  <th>Catégorie</th>
                  <th className="num">Stock</th>
                  {canEdit && <th aria-label="Modifier" />}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="stack-title">
                      <strong>{p.name}</strong>
                    </td>
                    <td data-label="Catégorie">{CATEGORY_LABELS[p.category]}</td>
                    <td className="num" data-label="Stock">
                      {formatNumber(p.stock)} {plural(p.unit, p.stock)}
                    </td>
                    <EditCell product={p} canEdit={canEdit} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

function HidesTable({ products, canEdit, blacksmith }: { products: Product[]; canEdit: boolean; blacksmith: number }) {
  return (
    <>
      <div className="table-wrap">
        <table className="stack-cards">
          <thead>
            <tr>
              <th>Animal</th>
              <th>Transformation</th>
              <th className="num">Rachat / peau</th>
              <th className="num">Vente / peau</th>
              <th className="num">Bénéfice / lot</th>
              {canEdit && <th aria-label="Modifier" />}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const gain = batchMargin(p, blacksmith);
              return (
                <tr key={p.id}>
                  <td className="stack-title">
                    <strong>{p.name}</strong>
                  </td>
                  <td data-label="Transformation">
                    {p.hidesPerBatch && p.leatherPerBatch
                      ? `${p.hidesPerBatch} ${plural("peau", p.hidesPerBatch)} → ${p.leatherPerBatch} ${plural("cuir", p.leatherPerBatch)}`
                      : "—"}
                  </td>
                  <td className="num minus" data-label="Rachat / peau">
                    {p.buyPrice == null ? "—" : septims(p.buyPrice)}
                    <CitizenPrice product={p} perUnit />
                  </td>
                  <td className="num" data-label="Vente / peau">{p.sellPrice == null ? "—" : septims(p.sellPrice)}</td>
                  <td className="num plus" data-label="Bénéfice / lot">{gain == null ? "—" : septims(gain, { signed: true })}</td>
                  <EditCell product={p} canEdit={canEdit} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>
        Les bénéfices sont calculés avec le prix actuel de rachat du cuir par le forgeron :{" "}
        {septims(blacksmith)}. Ils sont bruts, hors frais.
      </p>
    </>
  );
}

/** A category's grid in the hunting products, with its own heading so it reads as a region. */
function Grid({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

/** Products whose name holds the search, ignoring case. */
function matching(products: Product[], search: string | string[] | undefined) {
  const q = searchParam(search).toLocaleLowerCase("fr");
  return q ? products.filter((p) => p.name.toLocaleLowerCase("fr").includes(q)) : products;
}

export default async function Tarifs({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  const [products, blacksmith] = await Promise.all([activeProducts(member.shopId), blacksmithLeatherPrice(member.shopId)]);
  const canEdit = isGerant(member);
  const query = searchParam(search.q);
  // Leather has its own tiles above; every other category has a grid.
  const hunted = matching(products, search.q).filter((p) => p.category !== "cuir");
  const leather = products.find((p) => p.category === "cuir");
  const hides = hunted.filter((p) => p.category === "peau" && priced(p));
  const meats = hunted.filter((p) => p.category === "viande" && priced(p));
  const goods = hunted.filter((p) => (p.category === "ressource" || p.category === "autre") && priced(p));
  const unpriced = hunted.filter((p) => !priced(p));
  const autoUnpriced = Boolean(query) && hunted.length < AUTO_UNPRICED_BELOW;
  const calculable = products.filter(priced);

  return (
    <>
      <div className="panel-head">
        <PageHead title="Tarifs" />
        {canEdit && (
          <Link className="btn" href="/marchandises">
            <Settings2 size={16} /> Gérer les tarifs
          </Link>
        )}
      </div>

      <div className="cols cols-stretch section-gap">
        <section className="panel" aria-labelledby="cuir">
          <div className="eyebrow">Produits transformés</div>
          <h2 id="cuir">Tarifs du cuir</h2>
          <div className="stats" style={{ marginTop: 14 }}>
            {leather?.citizenBuyPrice != null && (
              <div className="stat stat-citizen" data-testid="rachat-cuir-citoyens">
                <div className="stat-label">Rachat de cuir · citoyens d&apos;Estemarche</div>
                <div className="stat-value">{septims(leather.citizenBuyPrice)}</div>
              </div>
            )}
            <div className="stat">
              <div className="stat-label">
                {leather?.citizenBuyPrice == null ? "Rachat de cuir" : "Rachat de cuir · autres vendeurs"}
              </div>
              <div className="stat-value">{leather?.buyPrice == null ? "—" : septims(leather.buyPrice)}</div>
            </div>
          </div>
          {/* What the comptoir pays on the first line, what it resells for on the second. */}
          <div className="stats" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="stat-label">Vente de cuir</div>
              <div className="stat-value">{leather?.sellPrice == null ? "—" : septims(leather.sellPrice)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Rachat par le forgeron</div>
              <div className="stat-value">{septims(blacksmith)}</div>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="calcul">
          <div className="eyebrow">Outil des marchands</div>
          <h2 id="calcul">Calculateur des prix</h2>
          <p className="muted">Rachat, revente et bénéfice pour une quantité donnée.</p>
          <PriceCalculator products={calculable} initialId={leather?.id} />
        </section>
      </div>

      <section className="panel" aria-labelledby="chasse">
        <div className="eyebrow">Produits de chasse</div>
        <h2 id="chasse">
          <Tag size={18} style={{ verticalAlign: "-2px" }} /> Grille du comptoir
        </h2>
        <p className="muted">Prix de rachat et de vente, tarifs de gros et rentabilité des transformations.</p>
        <LiveSearch />
        {/* A search shows only the categories it finds something in. */}
        {hides.length > 0 && (
          <Grid id="grille-peaux" title="Peaux">
            <HidesTable products={hides} canEdit={canEdit} blacksmith={blacksmith} />
          </Grid>
        )}
        {meats.length > 0 && (
          <Grid id="grille-viandes" title="Viandes et venaison">
            <GoodsTable products={meats} canEdit={canEdit} />
          </Grid>
        )}
        {goods.length > 0 && (
          <Grid id="grille-ressources" title="Autres ressources">
            <GoodsTable products={goods} canEdit={canEdit} />
          </Grid>
        )}
        {hunted.length === 0 && NO_MATCH}
        <Unpriced search={search} products={unpriced} canEdit={canEdit} auto={autoUnpriced} />
      </section>
    </>
  );
}
