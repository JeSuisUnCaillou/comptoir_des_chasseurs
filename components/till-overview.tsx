import { septims } from "@/lib/pricing";
import type { Till } from "@/lib/register";

/** The four tiles of the till since the opening, as in the old app. */
export function TillOverview({ till }: { till: Till }) {
  const movements = till.inflows - till.outflows;
  return (
    <div className="stats till-overview">
      <div className="stat stat-accent-gold" data-testid="caisse-totale">
        <div className="stat-label">Trésorerie actuelle</div>
        <div className={`stat-value ${till.balance < 0 ? "minus" : ""}`}>{septims(till.balance)}</div>
        <div className="small muted">
          Solde calculé depuis les écritures
          {movements !== 0 && `, dont ${septims(movements, { signed: true })} en mouvements de caisse`}
        </div>
      </div>
      <div className="stat stat-accent-green" data-testid="total-ventes">
        <div className="stat-label">Total des ventes</div>
        <div className="stat-value plus">{septims(till.sales)}</div>
      </div>
      <div className="stat stat-accent-red" data-testid="total-rachats">
        <div className="stat-label">Total des rachats</div>
        <div className="stat-value minus">{septims(till.buybacks)}</div>
      </div>
      <div className="stat stat-accent-gold" data-testid="solde-ventes-rachats">
        <div className="stat-label">Solde ventes − rachats</div>
        <div className={`stat-value ${till.margin < 0 ? "minus" : ""}`}>{septims(till.margin)}</div>
      </div>
    </div>
  );
}
