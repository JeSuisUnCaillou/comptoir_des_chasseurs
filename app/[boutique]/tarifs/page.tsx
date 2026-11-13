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
import {
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
import type { ShopProduct as Product } from "@/lib/privileged-groups";
import { activeProducts, blacksmithLeatherPrice, featuredProduct, type CategorizedProduct } from "@/lib/products";
import { shopCategories } from "@/lib/categories";
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

/** The privileged groups' buyback prices, under the usual one, for those the product has one for. */
function PrivilegedPrices({ product, perUnit = false }: { product: Product; perUnit?: boolean }) {
  return product.privileged.map((g) => (
    <div key={g.groupId} className="privileged-price">
      <span className="badge badge-gold">
        {g.name} : <strong>{perUnit ? septims(g.price) : rate(g.price, product.buyQty)}</strong>
      </span>
    </div>
  ));
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
            <PrivilegedPrices product={p} />
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
  products: CategorizedProduct[];
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
              values: [p.name, p.categoryName, p.stock],
              cells: (
                <>
                  <td className="stack-title">
                    <strong>{p.name}</strong>
                  </td>
                  <td data-label="Catégorie">{p.categoryName}</td>
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
                  <PrivilegedPrices product={p} perUnit />
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
 * The featured product's buyback and sale prices, its privileged groups' ones
 * first; for leather, what the blacksmith pays for it beside the sale.
 */
function FeaturedTiles({ product, blacksmith }: { product: Product; blacksmith: number }) {
  return (
    <>
      <div className="stats" style={{ marginTop: 14 }}>
        {product.privileged.map((g) => (
          <div key={g.groupId} className="stat stat-privileged" data-testid="rachat-phare-privilegie">
            <div className="stat-label">Rachat · {g.name}</div>
            <div className="stat-value">{tilePrice(g.price, product.buyQty)}</div>
          </div>
        ))}
        <div className="stat">
          <div className="stat-label">{product.privileged.length === 0 ? "Rachat" : "Rachat · autres vendeurs"}</div>
          <div className="stat-value">{tilePrice(product.buyPrice, product.buyQty)}</div>
        </div>
      </div>
      {/* What the shop pays on the first line, what it resells for on the second. */}
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat">
          <div className="stat-label">Vente</div>
          <div className="stat-value">{tilePrice(product.sellPrice, product.sellQty)}</div>
        </div>
        {product.leather && (
          <div className="stat">
            <div className="stat-label">Rachat par le forgeron</div>
            <div className="stat-value">{septims(blacksmith)}</div>
          </div>
        )}
      </div>
    </>
  );
}

/** Products whose name holds the search, ignoring case. */
function matching<P extends Product>(products: P[], search: string | string[] | undefined) {
  const q = searchParam(search).toLocaleLowerCase("fr");
  return q ? products.filter((p) => p.name.toLocaleLowerCase("fr").includes(q)) : products;
}

export default async function Tarifs({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const at = (path: string) => shopPath(member.shop.slug, path);
  const search = await searchParams;
  const [products, blacksmith, categories] = await Promise.all([
    activeProducts(member.shopId),
    blacksmithLeatherPrice(member.shopId),
    shopCategories(member.shopId),
  ]);
  const edit = isGerant(member) ? member.shop.slug : null;
  const query = searchParam(search.q);
  const featured = await featuredProduct(member.shopId, products);
  // The featured product has its own tiles above; every other one is in a grid.
  const hunted = matching(products, search.q).filter((p) => p.id !== featured?.id);
  // One grid per category, in their order; the hides' one shows their batches.
  const grids = categories
    .map((category) => ({ category, products: hunted.filter((p) => p.categoryId === category.id && priced(p)) }))
    .filter((grid) => grid.products.length > 0);
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
          <div className="eyebrow">Produit phare</div>
          <h2 id="phare">{featured?.name ?? "Aucun produit phare"}</h2>
          {featured ? (
            <FeaturedTiles product={featured} blacksmith={blacksmith} />
          ) : (
            <p className="muted">Un gérant le choisit dans Gérer les marchandises.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="calcul">
          <div className="eyebrow">Outil des marchands</div>
          <h2 id="calcul">Calculateur des prix</h2>
          <p className="muted">Rachat, revente et bénéfice pour une quantité donnée.</p>
          <PriceCalculator products={calculable} initialId={featured?.id} />
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
        {grids.map(({ category, products }) => (
          <Grid key={category.id} id={`grille-${category.id}`} title={category.name}>
            {category.hides ? (
              <HidesTable products={products} edit={edit} blacksmith={blacksmith} />
            ) : (
              <GoodsTable products={products} edit={edit} />
            )}
          </Grid>
        ))}
        {hunted.length === 0 && NO_MATCH}
        <Unpriced search={search} products={unpriced} edit={edit} slug={member.shop.slug} auto={autoUnpriced} />
      </section>
    </>
  );
}
