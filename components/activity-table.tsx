import type { ActivityLine } from "@/lib/activity";
import { formatNumber, septims } from "@/lib/pricing";
import { isCashKind, signedAmount } from "@/lib/transaction-kinds";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const BADGES = {
  vente: { label: "Vente", className: "badge-green" },
  rachat: { label: "Achat", className: "badge-gold" },
  entree: { label: "Caisse", className: "badge-blue" },
  sortie: { label: "Caisse", className: "badge-blue" },
  stock: { label: "Stock", className: "" },
} as const;

/** A member's sales, buybacks, cash movements and hand stock movements, in one list. */
export function ActivityTable({ lines, empty }: { lines: ActivityLine[]; empty: string }) {
  if (lines.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table data-testid="activite">
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
          {lines.map((l) => {
            const kind = l.kind;
            const badge = BADGES[kind];
            // What the line did to the till; null for a stock movement, which has no money.
            const money = kind === "stock" ? null : signedAmount(kind, l.amount);
            const quantity =
              kind === "stock"
                ? `${l.quantity > 0 ? "+" : "−"}${formatNumber(Math.abs(l.quantity))}`
                : isCashKind(kind)
                  ? "—"
                  : formatNumber(l.quantity);
            const cancelled = l.cancelledAt != null;
            return (
              <tr key={`${l.source}-${l.id}`} className={cancelled ? "cancelled" : undefined}>
                <td className="num">{dateTime.format(l.createdAt)}</td>
                <td>
                  <span className={`badge ${badge.className}`}>{badge.label}</span>
                </td>
                <td>{l.label}</td>
                <td className={`num ${kind === "stock" ? (l.quantity > 0 ? "plus" : "minus") : ""}`}>{quantity}</td>
                <td className={`num ${money == null || cancelled ? "" : money >= 0 ? "plus" : "minus"}`}>
                  {money == null ? "—" : septims(money, { signed: true })}
                </td>
                <td>{l.detail ?? "—"}</td>
                <td className="small">{l.notes ?? ""}</td>
                <td>
                  {cancelled && (
                    <span className="small muted">Annulée{l.cancelledBy ? ` par ${l.cancelledBy}` : ""}</span>
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
