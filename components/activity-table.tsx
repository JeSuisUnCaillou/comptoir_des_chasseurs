import type { ReactNode } from "react";
import { OperationBadge, TillPendingBadge } from "@/components/operation-badge";
import { SettleButton } from "@/components/settle-button";
import type { ActivityLine } from "@/lib/activity";
import { entryClasses, entryPositions } from "@/lib/entry-groups";
import { formatNumber, septims } from "@/lib/pricing";
import { isCashKind, signedAmount } from "@/lib/transaction-kinds";

/** What the "Client / vendeur, ou motif" column holds, by operation: its label on a phone card. */
const PARTY_LABEL: Record<ActivityLine["kind"], string> = {
  vente: "Client",
  rachat: "Vendeur",
  entree: "Pour / de la part de",
  sortie: "Pour / de la part de",
  stock: "Motif",
};

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

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
            <th>Client / vendeur, ou motif</th>
            <th>Notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const place = positions[i];
            const shared = (text: ReactNode) =>
              place.first ? text : <span className="sr-only">{text}</span>;
            const kind = l.kind;
            // What the line did to the till; null for a stock movement, which has no money.
            const money = kind === "stock" ? null : signedAmount(kind, l.amount);
            const quantity =
              kind === "stock"
                ? `${l.quantity > 0 ? "+" : "−"}${formatNumber(Math.abs(l.quantity))}`
                : isCashKind(kind)
                  ? "—"
                  : formatNumber(l.quantity);
            const cancelled = l.cancelledAt != null;
            const waiting = !cancelled && l.tillPending;
            // On a phone each line is a card (see `.entry-cards` in globals.css).
            const rep = place.first ? "" : " cell-repeat";
            return (
              <tr
                key={`${l.source}-${l.id}`}
                className={[...entryClasses(place), ...(cancelled ? ["cancelled"] : [])].join(" ") || undefined}
              >
                <td className={`num cell-date${rep}`}>{shared(dateTime.format(l.createdAt))}</td>
                <td className={`cell-kind${rep}`}>{shared(<OperationBadge kind={kind} />)}</td>
                <td className="cell-label">{l.label}</td>
                <td className={`num cell-qty${kind !== "stock" && isCashKind(kind) ? " cell-none" : ""} ${kind === "stock" ? (l.quantity > 0 ? "plus" : "minus") : ""}`}>{quantity}</td>
                <td className={`num cell-amount${money == null ? " cell-none" : ""} ${money == null || cancelled ? "" : waiting ? "muted" : money >= 0 ? "plus" : "minus"}`}>
                  {money == null ? "—" : septims(money, { signed: true })}
                  {waiting && (
                    <>
                      <br />
                      <TillPendingBadge />
                    </>
                  )}
                </td>
                <td
                  className={`cell-party${rep}${l.detail ? "" : " cell-none"}`}
                  data-label={PARTY_LABEL[kind]}
                >{shared(l.detail ?? "—")}</td>
                <td className={`small cell-notes${rep}`}>{shared(l.notes ?? "")}</td>
                <td className="cell-actions">
                  {cancelled ? (
                    <span className="small muted">Annulée{l.cancelledBy ? ` par ${l.cancelledBy}` : ""}</span>
                  ) : (
                    waiting && canSettle && place.settles && <SettleButton id={l.id} sale={kind === "vente"} entry={l} />
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
