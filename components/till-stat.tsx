import { septims } from "@/lib/pricing";
import type { Till } from "@/lib/register";

export function TillStat({ title, till, testId }: { title: string; till: Till; testId?: string }) {
  return (
    <div className="stat" data-testid={testId}>
      <div className="stat-label">{title}</div>
      <div className={`stat-value ${till.balance >= 0 ? "plus" : "minus"}`}>
        {septims(till.balance, { signed: true })}
      </div>
      <div className="small muted">
        {septims(till.sales)} encaissés · {septims(till.buybacks)} payés
        {(till.inflows !== 0 || till.outflows !== 0) &&
          ` · ${septims(till.inflows - till.outflows, { signed: true })} en mouvements de caisse`}
      </div>
    </div>
  );
}
