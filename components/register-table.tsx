import { CancelButton } from "@/components/cancel-button";
import type { Member } from "@/lib/db/schema";
import { formatNumber, septims } from "@/lib/pricing";
import type { RegisterEntry } from "@/lib/register";

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

export function RegisterTable({
  entries,
  member,
  showNotes = true,
  highlight,
}: {
  entries: RegisterEntry[];
  member: Pick<Member, "id" | "role">;
  showNotes?: boolean;
  highlight?: number;
}) {
  if (entries.length === 0) return <p className="muted">Aucune écriture pour l&apos;instant.</p>;
  return (
    <div className="table-wrap">
      <table data-testid="registre">
        <thead>
          <tr>
            <th>Date</th>
            <th>Opération</th>
            <th>Article</th>
            <th className="num">Quantité</th>
            <th className="num">Caisse</th>
            <th>Client / vendeur</th>
            <th>Employé</th>
            {showNotes && <th>Notes</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const sale = e.kind === "vente";
            const cash = e.kind === "entree" || e.kind === "sortie";
            const moneyIn = sale || e.kind === "entree";
            const cancelled = e.cancelledAt != null;
            const canCancel = !cancelled && (member.role === "gerant" || e.memberId === member.id);
            const label = cash ? `le mouvement de caisse n°${e.id}` : sale ? `la vente n°${e.id}` : `l'achat n°${e.id}`;
            return (
              <tr
                key={e.id}
                className={cancelled ? "cancelled" : e.id === highlight ? "fresh" : undefined}
                data-testid={`ligne-${e.id}`}
              >
                <td className="num">{dateTime.format(e.createdAt)}</td>
                <td>
                  <span className={`badge ${cash ? "badge-blue" : sale ? "badge-green" : "badge-gold"}`}>
                    {cash ? "Caisse" : sale ? "Vente" : "Achat"}
                  </span>
                </td>
                <td>{e.label}</td>
                <td className="num">{cash ? "—" : formatNumber(e.quantity)}</td>
                <td className={`num ${cancelled ? "" : moneyIn ? "plus" : "minus"}`}>
                  {septims(moneyIn ? e.amount : -e.amount, { signed: true })}
                </td>
                <td>{e.counterparty ?? "—"}</td>
                <td>{e.member}</td>
                {showNotes && <td className="small">{e.notes ?? ""}</td>}
                <td>
                  {cancelled ? (
                    <span className="small muted">Annulée{e.cancelledBy ? ` par ${e.cancelledBy}` : ""}</span>
                  ) : (
                    canCancel && (
                      <CancelButton
                        id={e.id}
                        label={label}
                        effect={
                          cash
                            ? "L'argent ne compte plus dans la caisse."
                            : e.productId == null
                              ? "Le stock n'est pas touché."
                              : sale
                                ? `${e.quantity} ${e.label} reviendront en stock.`
                                : `${e.quantity} ${e.label} sortiront du stock.`
                        }
                      />
                    )
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
