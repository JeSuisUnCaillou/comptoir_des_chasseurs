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
      <table data-testid="historique">
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
            return (
              <tr
                key={m.id}
                className={[...entryClasses(place), ...(highlight.includes(m.id) ? ["fresh"] : [])].join(" ")}
              >
                <td className="num">{shared(dateTime.format(m.createdAt))}</td>
                <td>{m.product}</td>
                <td className={`num ${m.delta > 0 ? "plus" : "minus"}`}>
                  {m.delta > 0 ? "+" : "−"}
                  {formatNumber(Math.abs(m.delta))}
                </td>
                <td className="num">
                  {formatNumber(m.stockAfter)} {plural(m.unit, m.stockAfter)}
                </td>
                <td>{shared(m.member)}</td>
                <td>{shared(m.reason)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
