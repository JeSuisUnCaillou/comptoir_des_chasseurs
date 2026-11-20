import type { ReactNode } from "react";
import { EntryButtons, LineButtons, hasEntryButtons, hasLineButtons } from "@/components/entry-buttons";
import { CancelledNote } from "@/components/entry-cells";
import type { MemberRole } from "@/lib/db/schema";
import { entryClasses, entryPositions } from "@/lib/entry-groups";
import { canActOn } from "@/lib/policies";
import { formatNumber, plural } from "@/lib/pricing";
import type { Movement } from "@/lib/stock";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * Stock movements, newest first, with their author and reason. The movements
 * written together form one card; `highlight` marks the ones just written.
 * A movement made by hand has the register's buttons for its author and the
 * gérants: change its units, cancel or restore it, or all of its entry; a
 * sale's or buyback's has them on its register line.
 */
export function MovementTable({
  movements,
  empty,
  member,
  shopSlug,
  back,
  highlight = [],
}: {
  movements: Movement[];
  empty: string;
  /** Who looks: their buttons. */
  member: { id: number; role: MemberRole };
  /** The shop's address, for the link that edits a movement. */
  shopSlug: string;
  /** This page, where editing a movement comes back to. */
  back: string;
  highlight?: number[];
}) {
  if (movements.length === 0) return <p className="muted">{empty}</p>;
  const positions = entryPositions(movements, () => false);
  return (
    <div className="table-wrap">
      <table className="entry-cards" data-testid="historique">
        <thead>
          <tr>
            <th>Date</th>
            <th>Marchandise</th>
            <th className="num">Mouvement</th>
            <th className="num">Stock après</th>
            <th>Employé</th>
            <th>Motif</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {movements.map((m, i) => {
            const place = positions[i];
            // What the movements of one entry share is written on its first line.
            const shared = (text: ReactNode) => (place.first ? text : <span className="sr-only">{text}</span>);
            // On a phone each line is a card (see `.entry-cards` in globals.css).
            const rep = place.first ? "" : " cell-repeat";
            const cancelled = m.cancelledAt != null;
            const mine = m.transactionId == null && canActOn(member, m);
            const line = { ...m, kind: "stock" as const, label: m.product, quantity: m.delta, stockBack: 0 };
            const buttons = mine && hasLineButtons(line);
            const whole = mine && place.first && hasEntryButtons(line, true);
            return (
              <tr
                key={m.id}
                className={[
                  ...entryClasses(place),
                  ...(highlight.includes(m.id) ? ["fresh"] : []),
                  ...(cancelled ? ["cancelled"] : []),
                ].join(" ")}
              >
                <td className={`num cell-date${rep}`}>{shared(dateTime.format(m.createdAt))}</td>
                <td className="cell-label">{m.product}</td>
                <td className={`num cell-qty ${m.delta > 0 ? "plus" : m.delta < 0 ? "minus" : ""}`}>
                  {m.delta > 0 ? "+" : m.delta < 0 ? "−" : ""}
                  {formatNumber(Math.abs(m.delta))}
                </td>
                <td className="num cell-after" data-label="Stock après">
                  {formatNumber(m.stockAfter)} {plural(m.unit, m.stockAfter)}
                </td>
                <td className={`cell-member${rep}`} data-label="Employé">
                  {shared(m.member)}
                </td>
                <td className={`cell-notes${rep}`}>{shared(m.reason)}</td>
                <td className="cell-actions">
                  {(cancelled || buttons || whole || m.editedBy) && (
                    <div className="row-actions">
                      {cancelled && <CancelledNote by={m.cancelledBy} beside={mine} />}
                      {!cancelled && m.editedBy && <span className="small muted">Modifiée par {m.editedBy}</span>}
                      {buttons && <LineButtons line={line} shopSlug={shopSlug} back={back} />}
                      {whole && <EntryButtons entry={line} shopSlug={shopSlug} back={back} />}
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
