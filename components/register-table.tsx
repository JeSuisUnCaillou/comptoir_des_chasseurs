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
}: {
  entries: RegisterEntry[];
  member: Pick<Member, "id" | "role">;
  showNotes?: boolean;
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
            const cancelled = e.cancelledAt != null;
            const canCancel = !cancelled && (member.role === "gerant" || e.memberId === member.id);
            const label = `${sale ? "vente" : "rachat"} n°${e.id}`;
            return (
              <tr key={e.id} className={cancelled ? "cancelled" : undefined} data-testid={`ligne-${e.id}`}>
                <td className="num">{dateTime.format(e.createdAt)}</td>
                <td>
                  <span className={`badge ${sale ? "badge-green" : "badge-gold"}`}>{sale ? "Vente" : "Rachat"}</span>
                </td>
                <td>{e.label}</td>
                <td className="num">{formatNumber(e.quantity)}</td>
                <td className={`num ${cancelled ? "" : sale ? "plus" : "minus"}`}>
                  {septims(sale ? e.amount : -e.amount, { signed: true })}
                </td>
                <td>{e.counterparty ?? "—"}</td>
                <td>{e.member}</td>
                {showNotes && <td className="small">{e.notes ?? ""}</td>}
                <td>
                  {cancelled ? (
                    <span className="small muted">Annulée{e.cancelledBy ? ` par ${e.cancelledBy}` : ""}</span>
                  ) : (
                    canCancel && <CancelButton id={e.id} label={label} />
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
