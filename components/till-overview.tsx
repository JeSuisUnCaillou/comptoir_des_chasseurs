import { septims } from "@/lib/pricing";
import type { Till } from "@/lib/register";

/**
 * The four tiles of the till: in large, since the latest declared end of the
 * week; below, discreet, since the opening.
 */
export function TillOverview({ week, all, days }: { week: Till; all: Till; days: number | null }) {
  const movements = week.inflows - week.outflows;
  const since = <div className="stat-since">{sinceLabel(days)}</div>;
  return (
    <div className="stats till-overview">
      <div className="stat stat-accent-gold" data-testid="caisse-totale">
        <div className="stat-label">Trésorerie</div>
        <div className={`stat-value ${week.balance < 0 ? "minus" : week.balance > 0 ? "plus" : ""}`}>
          {septims(week.balance, { signed: true })}
        </div>
        {since}
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
        {since}
        <div className="stat-total">Total : {septims(all.sales)}</div>
      </div>
      <div className="stat stat-accent-red" data-testid="total-rachats">
        <div className="stat-label">Rachats</div>
        <div className="stat-value minus">{septims(week.buybacks)}</div>
        {since}
        <div className="stat-total">Total : {septims(all.buybacks)}</div>
      </div>
      <div className="stat stat-accent-gold" data-testid="solde-ventes-rachats">
        <div className="stat-label">Solde ventes − rachats</div>
        <div className={`stat-value ${week.margin < 0 ? "minus" : ""}`}>{septims(week.margin)}</div>
        {since}
        <div className="stat-total">Total : {septims(all.margin)}</div>
      </div>
    </div>
  );
}

/** "depuis 3 jours", from the end of the week; "depuis l'ouverture" before the first. */
function sinceLabel(days: number | null) {
  if (days === null) return "depuis l'ouverture";
  if (days <= 0) return "depuis aujourd'hui";
  return `depuis ${days} jour${days >= 2 ? "s" : ""}`;
}
