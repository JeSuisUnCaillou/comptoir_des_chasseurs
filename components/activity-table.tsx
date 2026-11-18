import { AmountCell, CancelledNote, DateCell, KindCell, PartyCell, entryPlace } from "@/components/entry-cells";
import { SettleButton } from "@/components/settle-button";
import type { ActivityLine } from "@/lib/activity";
import { entryClasses, entryPositions, entryTotals } from "@/lib/entry-groups";
import { formatNumber } from "@/lib/pricing";
import { counterpartyLabel, isCashKind, signedAmount } from "@/lib/transaction-kinds";

/**
 * A member's sales, buybacks, cash movements and hand stock movements, in one list.
 * With `canSettle` (a gérant, or the member themself), a line waiting for the
 * till gets the button saying its septims are now in it, or out of it.
 */
export function ActivityTable({
  lines,
  empty,
  canSettle = false,
}: {
  lines: ActivityLine[];
  empty: string;
  canSettle?: boolean;
}) {
  if (lines.length === 0) return <p className="muted">{empty}</p>;
  // The lines of one entry form a block; what they share is written on its first line.
  const positions = entryPositions(lines, (l) => l.cancelledAt == null && l.tillPending);
  const totals = entryTotals(lines, positions, (l) =>
    l.entrySum == null || l.kind === "stock" ? null : signedAmount(l.kind, l.entrySum),
  );
  return (
    <div className="table-wrap">
      <table className="entry-cards" data-testid="activite">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opération</th>
            <th>Article</th>
            <th className="num">Quantité</th>
            <th className="num">Caisse</th>
            <th>Client / vendeur</th>
            <th>Notes / motif</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const place = positions[i];
            const { shared, rep } = entryPlace(place);
            const kind = l.kind;
            // What the line did to the till; null for a stock movement, which has no money.
            const money = kind === "stock" ? null : signedAmount(kind, l.amount);
            const quantity =
              kind === "stock"
                ? `${l.quantity > 0 ? "+" : "−"}${formatNumber(Math.abs(l.quantity))}`
                : isCashKind(kind)
                  ? "—"
                  : formatNumber(l.quantity);
            // A stock movement has no client or seller: its reason goes with the notes.
            const party = kind === "stock" ? null : l.detail;
            const notes = kind === "stock" ? l.detail : l.notes;
            const cancelled = l.cancelledAt != null;
            const waiting = !cancelled && l.tillPending;
            return (
              <tr
                key={`${l.source}-${l.id}`}
                className={[...entryClasses(place), ...(cancelled ? ["cancelled"] : [])].join(" ") || undefined}
              >
                <DateCell at={l.createdAt} place={place} />
                <KindCell kind={kind} place={place} />
                <td className="cell-label">{l.label}</td>
                <td className={`num cell-qty${kind !== "stock" && isCashKind(kind) ? " cell-none" : ""} ${kind === "stock" ? (l.quantity > 0 ? "plus" : "minus") : ""}`}>{quantity}</td>
                <AmountCell money={money} cancelled={cancelled} waiting={waiting} />
                <PartyCell
                  party={party}
                  label={kind === "stock" ? undefined : counterpartyLabel(kind)}
                  total={totals[i]}
                  place={place}
                />
                <td
                  className={`small cell-notes${rep}`}
                  data-label={kind === "stock" && notes ? "Motif" : undefined}
                >{shared(notes ?? "")}</td>
                <td className="cell-actions">
                  {cancelled ? (
                    <CancelledNote by={l.cancelledBy} />
                  ) : (
                    waiting && canSettle && place.settles && kind !== "stock" && <SettleButton id={l.id} kind={kind} entry={l} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
