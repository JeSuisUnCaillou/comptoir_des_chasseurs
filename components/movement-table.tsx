import { formatNumber, plural } from "@/lib/pricing";
import type { Movement } from "@/lib/products";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Stock movements, newest first, with their author and reason. */
export function MovementTable({ movements, empty }: { movements: Movement[]; empty: string }) {
  if (movements.length === 0) return <p className="muted">{empty}</p>;
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
          {movements.map((m) => (
            <tr key={m.id}>
              <td className="num">{dateTime.format(m.createdAt)}</td>
              <td>{m.product}</td>
              <td className={`num ${m.delta > 0 ? "plus" : "minus"}`}>
                {m.delta > 0 ? "+" : "−"}
                {formatNumber(Math.abs(m.delta))}
              </td>
              <td className="num">
                {formatNumber(m.stockAfter)} {plural(m.unit, m.stockAfter)}
              </td>
              <td>{m.member}</td>
              <td>{m.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
