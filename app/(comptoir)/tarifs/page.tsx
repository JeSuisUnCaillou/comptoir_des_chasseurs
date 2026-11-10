import Link from "next/link";
import { Settings2, Tag } from "lucide-react";
import { LiveSearch } from "@/components/live-search";
import { PageHead } from "@/components/page-head";
import { PriceCalculator } from "@/components/price-calculator";
import { requireMember } from "@/lib/auth/session";
import { param } from "@/lib/pagination";
import type { Product } from "@/lib/db/schema";
import {
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

function GoodsTable({ products }: { products: Product[] }) {
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
                <td className="num minus">{p.buyPrice == null ? "—" : rate(p.buyPrice, p.buyQty)}</td>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type Search = { q?: string | string[] };

export default async function Tarifs({ searchParams }: { searchParams: Promise<Search> }) {
  const member = await requireMember();
  const q = (param((await searchParams).q) ?? "").trim().slice(0, 100).toLocaleLowerCase("fr");
  const [products, blacksmith] = await Promise.all([activeProducts(), blacksmithLeatherPrice()]);
  const listed = products.filter((p) => !q || p.name.toLocaleLowerCase("fr").includes(q));
  const hides = listed.filter((p) => p.category === "peau" && priced(p));
  const leather = products.find((p) => p.category === "cuir");
  const meats = listed.filter((p) => p.category === "viande" && priced(p));
  const goods = listed.filter((p) => (p.category === "ressource" || p.category === "autre") && priced(p));
  const calculable = products.filter(priced);

  return (
    <>
      <div className="panel-head">
        <PageHead title="Tarifs" />
        {member.role === "gerant" && (
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
            <div className="stat">
              <div className="stat-label">Rachat de cuir</div>
              <div className="stat-value">{leather?.buyPrice == null ? "—" : septims(leather.buyPrice)}</div>
            </div>
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

      <LiveSearch />

      <section className="panel" aria-labelledby="peaux">
        <div className="eyebrow">Grille du comptoir</div>
        <h2 id="peaux">
          <Tag size={18} style={{ verticalAlign: "-2px" }} /> Tarifs des peaux
        </h2>
        <p className="muted">Prix définis par la gérance et rentabilité des transformations.</p>
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
                      <td className="num minus">{p.buyPrice == null ? "—" : septims(p.buyPrice)}</td>
                      <td className="num">{p.sellPrice == null ? "—" : septims(p.sellPrice)}</td>
                      <td className="num plus">{gain == null ? "—" : septims(gain, { signed: true })}</td>
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
      </section>

      <section className="panel" aria-labelledby="chasse">
        <div className="eyebrow">Produits de chasse</div>
        <h2 id="chasse">Viandes, venaison et ressources</h2>
        <p className="muted">Prix de rachat, prix de vente et tarifs de gros.</p>
        <h3>Viandes et venaison</h3>
        <GoodsTable products={meats} />
        <h3>Autres ressources</h3>
        <GoodsTable products={goods} />
      </section>
    </>
  );
}
