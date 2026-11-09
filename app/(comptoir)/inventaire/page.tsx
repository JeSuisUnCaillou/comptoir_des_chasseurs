import { Archive } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { StockBoard } from "@/components/stock-board";
import { requireMember } from "@/lib/auth/session";
import { formatNumber, plural } from "@/lib/pricing";
import { activeProducts, recentMovements } from "@/lib/products";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export default async function Inventaire() {
  await requireMember();
  const [products, movements] = await Promise.all([activeProducts(), recentMovements()]);
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
          items={products.map(({ id, name, category, unit, stock }) => ({ id, name, category, unit, stock }))}
        />
      </section>

      <section className="panel">
        <h2>Historique des mouvements</h2>
        <p className="muted">Les 100 dernières entrées et sorties, avec leur auteur et leur motif.</p>
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
      </section>
    </>
  );
}
