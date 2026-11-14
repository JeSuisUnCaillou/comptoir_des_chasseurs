import type { EntryTotal as Total } from "@/lib/entry-groups";
import { septims } from "@/lib/pricing";

/**
 * The total of an entry of several lines, under its client or seller as a table,
 * at the bottom of its card on a phone (see `.entry-total` in globals.css).
 */
export function EntryTotal({ total }: { total: Total | null }) {
  if (total == null) return null;
  const where = [...(total.table ? ["on-table"] : []), ...(total.card ? ["on-card"] : [])].join(" ");
  return (
    <span className={`entry-total small ${where} ${total.total >= 0 ? "plus" : "minus"}`} data-testid="total-ecriture">
      Total : {septims(total.total, { signed: true })}
    </span>
  );
}
