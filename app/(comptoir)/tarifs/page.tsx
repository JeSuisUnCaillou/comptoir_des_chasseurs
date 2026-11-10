import Link from "next/link";
import { Eye, EyeOff, Pencil, Settings2, Tag } from "lucide-react";
import { LiveSearch } from "@/components/live-search";
import { PageHead } from "@/components/page-head";
import { PendingSpinner } from "@/components/nav-link";
import { PriceCalculator } from "@/components/price-calculator";
import { requireMember } from "@/lib/auth/session";
import { param } from "@/lib/pagination";
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
  if (products.length === 0) return NO_MATCH;
  return (
    <div className="table-wrap">
      <table>
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
                <td>
                  <strong>{p.name}</strong>
                </td>
                <td className="num minus">
                  {p.buyPrice == null ? "—" : rate(p.buyPrice, p.buyQty)}
                  <CitizenPrice product={p} />
                </td>
                <td className="num">{p.sellPrice == null ? "—" : rate(p.sellPrice, p.sellQty)}</td>
                <td className="num">
                  {p.bulkMin != null && p.bulkPrice != null
                    ? `Dès ${formatNumber(p.bulkMin)} : ${rate(p.bulkPrice, p.bulkQty)}`
                    : "—"}
                </td>
                <td className="num">
                  {formatNumber(p.stock)} {plural(p.unit, p.stock)}
                </td>
                <td className="num plus">
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

type Table = "peaux" | "chasse";
type Search = Partial<Record<Table | `${Table}-sans-tarif`, string | string[]>>;

/** Whether the table shows its products without a price, asked by its button. */
function showsUnpriced(search: Search, table: Table) {
  return param(search[`${table}-sans-tarif`]) === "1";
}

/**
 * Under a table, the button that shows or hides its products without a price,
 * keeping the rest of the address, and those products in a table of their own.
 */
function Unpriced({
  search,
  table,
  products,
  canEdit,
}: {
  search: Search;
  table: Table;
  products: Product[];
  canEdit: boolean;
}) {
  const shown = showsUnpriced(search, table);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    const v = param(value);
    if (v && key !== `${table}-sans-tarif`) query.set(key, v);
  }
  if (!shown) query.set(`${table}-sans-tarif`, "1");
  const qs = query.toString();
  return (
    <div className="unpriced">
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
      {shown &&
        (products.length === 0 ? (
          <p className="muted">Aucune marchandise sans tarif.</p>
        ) : (
          <div className="table-wrap">
            <table aria-label="Marchandises sans tarif">
              <thead>
                <tr>
                  <th>Marchandise sans tarif</th>
                  {table === "chasse" && <th>Catégorie</th>}
                  <th className="num">Stock</th>
                  {canEdit && <th aria-label="Modifier" />}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    {table === "chasse" && <td>{CATEGORY_LABELS[p.category]}</td>}
                    <td className="num">
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

/** Products whose name holds the search, ignoring case. */
function matching(products: Product[], search: string | string[] | undefined) {
  const q = (param(search) ?? "").trim().slice(0, 100).toLocaleLowerCase("fr");
  return q ? products.filter((p) => p.name.toLocaleLowerCase("fr").includes(q)) : products;
}

export default async function Tarifs({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const search = await searchParams;
  const [products, blacksmith] = await Promise.all([activeProducts(), blacksmithLeatherPrice()]);
  const canEdit = member.role === "gerant";
  const allHides = matching(products, search.peaux).filter((p) => p.category === "peau");
  const hides = allHides.filter(priced);
  const hunted = matching(products, search.chasse).filter((p) => p.category !== "peau" && p.category !== "cuir");
  const leather = products.find((p) => p.category === "cuir");
  const meats = hunted.filter((p) => p.category === "viande" && priced(p));
  const goods = hunted.filter((p) => p.category !== "viande" && priced(p));
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

      <div className="cols section-gap">
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
          <PriceCalculator products={calculable} />
        </section>
      </div>

      <section className="panel" aria-labelledby="peaux">
        <div className="eyebrow">Grille du comptoir</div>
        <h2 id="peaux">
          <Tag size={18} style={{ verticalAlign: "-2px" }} /> Tarifs des peaux
        </h2>
        <p className="muted">Prix définis par la gérance et rentabilité des transformations.</p>
        <LiveSearch name="peaux" />
        {hides.length === 0 ? NO_MATCH : (
          <div className="table-wrap">
            <table>
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
                {hides.map((p) => {
                  const gain = batchMargin(p, blacksmith);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        {p.hidesPerBatch && p.leatherPerBatch
                          ? `${p.hidesPerBatch} ${plural("peau", p.hidesPerBatch)} → ${p.leatherPerBatch} ${plural("cuir", p.leatherPerBatch)}`
                          : "—"}
                      </td>
                      <td className="num minus">
                        {p.buyPrice == null ? "—" : septims(p.buyPrice)}
                        <CitizenPrice product={p} perUnit />
                      </td>
                      <td className="num">{p.sellPrice == null ? "—" : septims(p.sellPrice)}</td>
                      <td className="num plus">{gain == null ? "—" : septims(gain, { signed: true })}</td>
                      <EditCell product={p} canEdit={canEdit} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 14 }}>
          Les bénéfices sont calculés avec le prix actuel de rachat du cuir par le forgeron :{" "}
          {septims(blacksmith)}. Ils sont bruts, hors frais.
        </p>
        <Unpriced search={search} table="peaux" products={allHides.filter((p) => !priced(p))} canEdit={canEdit} />
      </section>

      <section className="panel" aria-labelledby="chasse">
        <div className="eyebrow">Produits de chasse</div>
        <h2 id="chasse">Viandes, venaison et ressources</h2>
        <p className="muted">Prix de rachat, prix de vente et tarifs de gros.</p>
        <LiveSearch name="chasse" />
        <h3>Viandes et venaison</h3>
        <GoodsTable products={meats} canEdit={canEdit} />
        <h3>Autres ressources</h3>
        <GoodsTable products={goods} canEdit={canEdit} />
        <Unpriced search={search} table="chasse" products={hunted.filter((p) => !priced(p))} canEdit={canEdit} />
      </section>
    </>
  );
}
