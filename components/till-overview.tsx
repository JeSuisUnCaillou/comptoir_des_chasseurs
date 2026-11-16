import { septims } from "@/lib/pricing";
import type { Till } from "@/lib/register";

/**
 * The four tiles of the till: in large, since the latest declared end of the
 * week; below, discreet, since the opening.
 */
export function TillOverview({ week, all }: { week: Till; all: Till }) {
  const movements = week.inflows - week.outflows;
  return (
    <div className="stats till-overview">
      <div className="stat stat-accent-gold" data-testid="caisse-totale">
        <div className="stat-label">Trésorerie</div>
        <div className={`stat-value ${week.balance < 0 ? "minus" : week.balance > 0 ? "plus" : ""}`}>
          {septims(week.balance, { signed: true })}
        </div>
        {movements !== 0 && (
          <div className="small muted">
            Dont {septims(movements, { signed: true })} d&apos;entrées et sorties d&apos;argent hors achats et ventes
          </div>
        )}
        <div className="stat-total" data-testid="tresorerie-actuelle">
          En caisse : {septims(all.balance)}
        </div>
      </div>
      <div className="stat stat-accent-green" data-testid="total-ventes">
        <div className="stat-label">Ventes</div>
        <div className="stat-value plus">{septims(week.sales)}</div>
        <div className="stat-total">Total : {septims(all.sales)}</div>
      </div>
      <div className="stat stat-accent-red" data-testid="total-rachats">
        <div className="stat-label">Rachats</div>
        <div className="stat-value minus">{septims(week.buybacks)}</div>
        <div className="stat-total">Total : {septims(all.buybacks)}</div>
      </div>
      <div className="stat stat-accent-gold" data-testid="solde-ventes-rachats">
        <div className="stat-label">Solde ventes − rachats</div>
        <div className={`stat-value ${week.margin < 0 ? "minus" : ""}`}>{septims(week.margin)}</div>
        <div className="stat-total">Total : {septims(all.margin)}</div>
      </div>
    </div>
  );
}
