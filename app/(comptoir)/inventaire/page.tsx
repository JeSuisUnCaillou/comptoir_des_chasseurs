import { Archive } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { StockBoard } from "@/components/stock-board";
import { requireMember } from "@/lib/auth/session";
import type { ProductCategory } from "@/lib/db/schema";
import { formatNumber, plural } from "@/lib/pricing";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE, offsetOf, pageParam } from "@/lib/pagination";
import { activeProducts, movementCount, recentMovements } from "@/lib/products";

// Meats first, then hides, then everything else; the database already sorts by
// name and Array.prototype.sort is stable, so names stay in order inside each group.
const STOCK_GROUP: Partial<Record<ProductCategory, number>> = { viande: 0, peau: 1 };
const stockGroup = (category: ProductCategory) => STOCK_GROUP[category] ?? 2;

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function Inventaire({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireMember();
  const page = pageParam((await searchParams).page);
  const [products, movements, total] = await Promise.all([
    activeProducts(),
    recentMovements({ limit: PAGE_SIZE, offset: offsetOf(page) }),
    movementCount(),
  ]);
  const sum = (category: string) =>
    products.filter((p) => p.category === category).reduce((total, p) => total + p.stock, 0);
  const others = products.filter((p) => p.category !== "peau" && p.category !== "cuir").length;

  return (
    <>
      <PageHead title="Inventaire" />
      <section className="panel">
        <div className="eyebrow">Réserves du comptoir</div>
        <h2>
          <Archive size={18} style={{ verticalAlign: "-2px" }} /> Inventaire des marchandises
        </h2>
        <p className="muted">Entrées, sorties et quantités disponibles dans les réserves.</p>
        <div className="stats">
          <div className="stat">
            <div className="stat-label">Peaux en réserve</div>
            <div className="stat-value" data-testid="total-peaux">
              {formatNumber(sum("peau"))}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Cuirs en réserve</div>
            <div className="stat-value" data-testid="total-cuirs">
              {formatNumber(sum("cuir"))}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Autres références</div>
            <div className="stat-value">{formatNumber(others)}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Stock disponible</h2>
          <span className="small muted">{products.length} référence(s)</span>
        </div>
        <StockBoard
          items={[...products]
            .sort((a, b) => stockGroup(a.category) - stockGroup(b.category))
            .map(({ id, name, category, unit, stock }) => ({ id, name, category, unit, stock }))}
        />
      </section>

      <section className="panel">
        <h2>Historique des mouvements</h2>
        <p className="muted">Les entrées et sorties, des plus récentes aux plus anciennes, avec leur auteur et leur motif.</p>
        {movements.length === 0 ? (
          <p className="muted">Aucun mouvement pour l&apos;instant.</p>
        ) : (
          <div className="table-wrap">
            <table data-testid="historique">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Marchandise</th>
                  <th className="num">Mouvement</th>
                  <th className="num">Stock après</th>
                  <th>Employé</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="num">{dateTime.format(m.createdAt)}</td>
                    <td>{m.product}</td>
                    <td className={`num ${m.delta > 0 ? "plus" : "minus"}`}>
                      {m.delta > 0 ? "+" : "−"}
                      {formatNumber(Math.abs(m.delta))}
                    </td>
                    <td className="num">
                      {formatNumber(m.stockAfter)} {plural(m.unit, m.stockAfter)}
                    </td>
                    <td>{m.member}</td>
                    <td>{m.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} path="/inventaire" label="Pages de l'historique" />
      </section>
    </>
  );
}
