import { septims } from "@/lib/pricing";
import type { Till } from "@/lib/register";

/**
 * The four tiles of the till. Sales, buybacks and their margin: in large,
 * since the latest declared end of the week; below, discreet, since the
 * first line of the register. The treasury: in large, the whole till; below, how it moved since
 * the end of the week.
 */
export function TillOverview({
  week,
  all,
  days,
  allDays,
}: {
  week: Till;
  all: Till;
  days: number | null;
  allDays: number | null;
}) {
  const since = sinceLabel(days);
  const total = (amount: number) => (
    <div className="stat-total">
      {septims(amount)} {sinceLabel(allDays)}
    </div>
  );
  return (
    <div className="stats till-overview">
      <div className="stat stat-accent-gold" data-testid="caisse-totale">
        <div className="stat-label">Trésorerie actuelle</div>
        <div className={`stat-value ${all.balance < 0 ? "minus" : ""}`} data-testid="tresorerie-actuelle">
          {septims(all.balance)}
        </div>
        <div className="stat-since" data-testid="tresorerie-semaine">
          {septims(week.balance, { signed: true })} {since}
        </div>
      </div>
      <div className="stat stat-accent-green" data-testid="total-ventes">
        <div className="stat-label">Ventes {since}</div>
        <div className="stat-value plus">{septims(week.sales)}</div>
        {total(all.sales)}
      </div>
      <div className="stat stat-accent-red" data-testid="total-rachats">
        <div className="stat-label">Rachats {since}</div>
        <div className="stat-value minus">{septims(week.buybacks)}</div>
        {total(all.buybacks)}
      </div>
      <div className="stat stat-accent-gold" data-testid="solde-ventes-rachats">
        <div className="stat-label">Solde ventes − rachats {since}</div>
        <div className={`stat-value ${week.margin < 0 ? "minus" : ""}`}>{septims(week.margin)}</div>
        {total(all.margin)}
      </div>
    </div>
  );
}

/** "depuis 3 jours"; "depuis l'ouverture" when there is nothing to count from. */
function sinceLabel(days: number | null) {
  if (days === null) return "depuis l'ouverture";
  if (days <= 0) return "depuis aujourd'hui";
  return `depuis ${days} jour${days >= 2 ? "s" : ""}`;
}
