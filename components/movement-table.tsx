import type { ReactNode } from "react";
import { entryClasses, entryPositions } from "@/lib/entry-groups";
import { formatNumber, plural } from "@/lib/pricing";
import type { Movement } from "@/lib/products";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * Stock movements, newest first, with their author and reason. The movements
 * written together form one card; `highlight` marks the ones just written.
 */
export function MovementTable({
  movements,
  empty,
  highlight = [],
}: {
  movements: Movement[];
  empty: string;
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
          </tr>
        </thead>
        <tbody>
          {movements.map((m, i) => {
            const place = positions[i];
            // What the movements of one entry share is written on its first line.
            const shared = (text: ReactNode) => (place.first ? text : <span className="sr-only">{text}</span>);
            // On a phone each line is a card (see `.entry-cards` in globals.css).
            const rep = place.first ? "" : " cell-repeat";
            return (
              <tr
                key={m.id}
                className={[...entryClasses(place), ...(highlight.includes(m.id) ? ["fresh"] : [])].join(" ")}
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
