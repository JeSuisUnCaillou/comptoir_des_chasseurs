import Link from "next/link";
import type { ReactNode } from "react";
import { Eye, EyeOff, Pencil, Settings2, Tag } from "lucide-react";
import { LiveSearch } from "@/components/live-search";
import { PageHead } from "@/components/page-head";
import { PendingSpinner } from "@/components/nav-link";
import { PriceCalculator } from "@/components/price-calculator";
import { SortableTable, type SortColumn } from "@/components/sortable-table";
import { requireMember } from "@/lib/auth/session";
import { shopPath } from "@/lib/paths";
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
  leatherPerHide,
  plural,
  unitMargin,
  unitPrice,
} from "@/lib/pricing";
import { activeProducts, blacksmithLeatherPrice, featuredProducts } from "@/lib/products";
import { isGerant } from "@/lib/policies";

function priced(p: Product) {
  return p.buyPrice != null || p.sellPrice != null;
}

const NO_MATCH = <p className="muted">Aucune marchandise ne correspond.</p>;

/** A gérant's pencil to the product's form in Gérer les marchandises, at the end of its row. */
function EditCell({ product, edit }: { product: Product; edit: string | null }) {
  if (!edit) return null;
  return (
    <td className="row-action">
      <Link
        className="icon-btn"
        href={shopPath(edit, `/marchandises/${product.id}?depuis=tarifs`)}
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

/** The pencil's column, last, for a gérant. */
function withEdit(columns: SortColumn[], edit: string | null): SortColumn[] {
  return edit ? [...columns, { label: "", ariaLabel: "Modifier" }] : columns;
}

function GoodsTable({ products, edit }: { products: Product[]; edit: string | null }) {
  const columns = withEdit(
    [
      { label: "Marchandise" },
      { label: "Rachat", num: true },
      { label: "Vente", num: true },
      { label: "Gros", num: true },
      { label: "Stock", num: true },
      { label: "Bénéfice brut indicatif", num: true },
    ],
    edit,
  );
  const rows = products.map((p) => {
    const ref = referenceQuantity(p);
    const gross = margin(p, ref);
    return {
      key: p.id,
      // Prices for different lots compare per unit.
      values: [
        p.name,
        unitPrice(p.buyPrice, p.buyQty),
        unitPrice(p.sellPrice, p.sellQty),
        p.bulkMin == null ? null : unitPrice(p.bulkPrice, p.bulkQty),
        p.stock,
        unitMargin(p),
      ],
      cells: (
        <>
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
          <EditCell product={p} edit={edit} />
        </>
      ),
    };
  });
  return <SortableTable columns={columns} rows={rows} />;
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
  edit,
  slug,
  auto,
}: {
  search: Search;
  products: Product[];
  edit: string | null;
  slug: string;
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
        <Link className="btn btn-small" href={shopPath(slug, qs ? `/tarifs?${qs}` : "/tarifs")} scroll={false}>
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
          <SortableTable
            ariaLabel="Marchandises sans tarif"
            columns={withEdit(
              [{ label: "Marchandise sans tarif" }, { label: "Catégorie" }, { label: "Stock", num: true }],
              edit,
            )}
            rows={products.map((p) => ({
              key: p.id,
              values: [p.name, CATEGORY_LABELS[p.category], p.stock],
              cells: (
                <>
                  <td className="stack-title">
                    <strong>{p.name}</strong>
                  </td>
                  <td data-label="Catégorie">{CATEGORY_LABELS[p.category]}</td>
                  <td className="num" data-label="Stock">
                    {formatNumber(p.stock)} {plural(p.unit, p.stock)}
                  </td>
                  <EditCell product={p} edit={edit} />
                </>
              ),
            }))}
          />
        ))}
    </div>
  );
}

function HidesTable({ products, edit, blacksmith }: { products: Product[]; edit: string | null; blacksmith: number }) {
  return (
    <>
      <SortableTable
        columns={withEdit(
          [
            { label: "Animal" },
            { label: "Transformation" },
            { label: "Rachat / peau", num: true },
            { label: "Vente / peau", num: true },
            { label: "Bénéfice / lot", num: true },
          ],
          edit,
        )}
        rows={products.map((p) => {
          const gain = batchMargin(p, blacksmith);
          return {
            key: p.id,
            values: [p.name, leatherPerHide(p), p.buyPrice, p.sellPrice, gain],
            cells: (
              <>
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
                <EditCell product={p} edit={edit} />
              </>
            ),
          };
        })}
      />
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

/** A price as a tile shows it: per unit when it is for one. */
function tilePrice(price: number | null, qty: number) {
  if (price == null) return "—";
  return qty === 1 ? septims(price) : rate(price, qty);
}

/**
 * A featured product's line: its name, then its prices side by side, the
 * citizens' buyback first when it has one; for leather, what the blacksmith
 * pays for it after the sale. What the shop pays is red, what it gets green,
 * as in the calculator.
 */
function FeaturedRow({ product, blacksmith }: { product: Product; blacksmith: number }) {
  const id = `phare-${product.id}`;
  return (
    <section className="featured-row" aria-labelledby={id}>
      <h3 id={id}>{product.name}</h3>
      <div className="featured-prices">
        {product.citizenBuyPrice != null && (
          <div className="stat stat-citizen" data-testid="rachat-phare-citoyens">
            <div className="stat-label">Rachat · citoyens d&apos;Estemarche</div>
            <div className="stat-value minus">{tilePrice(product.citizenBuyPrice, product.buyQty)}</div>
          </div>
        )}
        <div className="stat">
          <div className="stat-label">{product.citizenBuyPrice == null ? "Rachat" : "Rachat · autres vendeurs"}</div>
          <div className="stat-value minus">{tilePrice(product.buyPrice, product.buyQty)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Vente</div>
          <div className="stat-value plus">{tilePrice(product.sellPrice, product.sellQty)}</div>
        </div>
        {product.category === "cuir" && (
          <div className="stat">
            <div className="stat-label">Rachat par le forgeron</div>
            <div className="stat-value plus">{septims(blacksmith)}</div>
          </div>
        )}
      </div>
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
  const at = (path: string) => shopPath(member.shop.slug, path);
  const search = await searchParams;
  const [products, blacksmith] = await Promise.all([activeProducts(member.shopId), blacksmithLeatherPrice(member.shopId)]);
  const edit = isGerant(member) ? member.shop.slug : null;
  const query = searchParam(search.q);
  const featured = featuredProducts(products);
  // The featured products have their own cards above; every other one is in a grid.
  const hunted = matching(products, search.q).filter((p) => p.featuredAt == null);
  const hides = hunted.filter((p) => p.category === "peau" && priced(p));
  const meats = hunted.filter((p) => p.category === "viande" && priced(p));
  const goods = hunted.filter((p) => p.category !== "peau" && p.category !== "viande" && priced(p));
  const unpriced = hunted.filter((p) => !priced(p));
  const autoUnpriced = Boolean(query) && hunted.length < AUTO_UNPRICED_BELOW;
  const calculable = products.filter(priced);

  return (
    <>
      <div className="panel-head">
        <PageHead title="Tarifs" />
        {edit && (
          <Link className="btn" href={at("/marchandises")}>
            <Settings2 size={16} /> Gérer les marchandises
          </Link>
        )}
      </div>

      <div className="cols cols-stretch section-gap">
        <section className="panel" aria-labelledby="phare">
          <div className="panel-head">
            <div>
              <div className="eyebrow">À la une</div>
              <h2 id="phare">Produits phares</h2>
            </div>
            {edit && (
              <Link
                className="icon-btn"
                href={at("/marchandises#phare")}
                title="Gérer les produits phares"
                aria-label="Gérer les produits phares"
              >
                <Pencil size={18} />
              </Link>
            )}
          </div>
          {featured.length > 0 ? (
            <div className="featured-rows">
              {featured.map((p) => (
                <FeaturedRow key={p.id} product={p} blacksmith={blacksmith} />
              ))}
            </div>
          ) : (
            <p className="muted">Aucun produit phare. Un gérant les choisit dans Gérer les marchandises.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="calcul">
          <div className="eyebrow">Outil des marchands</div>
          <h2 id="calcul">Calculateur des prix</h2>
          <p className="muted">Rachat, revente et bénéfice pour une quantité donnée.</p>
          <PriceCalculator products={calculable} initialId={featured[0]?.id} />
        </section>
      </div>

      <section className="panel" aria-labelledby="chasse">
        <div className="eyebrow">Marchandises</div>
        <h2 id="chasse">
          <Tag size={18} style={{ verticalAlign: "-2px" }} /> Grille des prix
        </h2>
        <p className="muted">Prix de rachat et de vente, tarifs de gros et rentabilité des transformations.</p>
        <LiveSearch />
        {/* A search shows only the categories it finds something in. */}
        {hides.length > 0 && (
          <Grid id="grille-peaux" title="Peaux">
            <HidesTable products={hides} edit={edit} blacksmith={blacksmith} />
          </Grid>
        )}
        {meats.length > 0 && (
          <Grid id="grille-viandes" title="Viandes et venaison">
            <GoodsTable products={meats} edit={edit} />
          </Grid>
        )}
        {goods.length > 0 && (
          <Grid id="grille-ressources" title="Autres ressources">
            <GoodsTable products={goods} edit={edit} />
          </Grid>
        )}
        {hunted.length === 0 && NO_MATCH}
        <Unpriced search={search} products={unpriced} edit={edit} slug={member.shop.slug} auto={autoUnpriced} />
      </section>
    </>
  );
}
