import { EntryButtons, LineButtons, hasEntryButtons, hasLineButtons } from "@/components/entry-buttons";
import { AmountCell, CancelledNote, DateCell, KindCell, PartyCell, entryPlace } from "@/components/entry-cells";
import { SettleButton } from "@/components/settle-button";
import type { ActivityLine } from "@/lib/activity";
import { entryClasses, entryPositions, entryTotals } from "@/lib/entry-groups";
import { formatNumber } from "@/lib/pricing";
import { counterpartyLabel, isCashKind, signedAmount } from "@/lib/transaction-kinds";

/**
 * A member's sales, buybacks, cash movements and hand stock movements, in one list.
 * With `canAct` (a gérant, or the member themself), its register lines get
 * the same buttons as in the register: settle a line waiting for the till,
 * change its septims, cancel or restore it, or all of its entry at once.
 */
export function ActivityTable({
  lines,
  empty,
  shopSlug,
  back,
  canAct = false,
}: {
  lines: ActivityLine[];
  empty: string;
  /** The shop's address, for the link that edits a line's septims. */
  shopSlug: string;
  /** This page, where editing a line's septims comes back to. */
  back: string;
  canAct?: boolean;
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
            const settles = kind !== "stock" && waiting && canAct && place.settles;
            const buttons = kind !== "stock" && canAct && hasLineButtons({ ...l, kind });
            // Like the register: the whole entry's buttons on its first line.
            const whole = kind !== "stock" && canAct && place.first && hasEntryButtons({ ...l, kind }, true);
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
                  {(cancelled || settles || buttons || whole || l.editedBy) && (
                    <div className="row-actions">
                      {cancelled && <CancelledNote by={l.cancelledBy} beside={canAct} />}
                      {!cancelled && l.editedBy && <span className="small muted">Modifiée par {l.editedBy}</span>}
                      {settles && <SettleButton id={l.id} kind={kind} entry={l} />}
                      {buttons && <LineButtons line={{ ...l, kind }} shopSlug={shopSlug} back={back} />}
                      {whole && <EntryButtons entry={{ ...l, kind }} shopSlug={shopSlug} back={back} />}
                    </div>
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
