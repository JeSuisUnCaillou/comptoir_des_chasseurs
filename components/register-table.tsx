import type { ReactNode } from "react";
import { CancelButton } from "@/components/cancel-button";
import { OperationBadge, TillPendingBadge } from "@/components/operation-badge";
import { SettleButton } from "@/components/settle-button";
import type { Member } from "@/lib/db/schema";
import { entryClasses, entryPositions } from "@/lib/entry-groups";
import { formatNumber, septims } from "@/lib/pricing";
import { isCashKind, signedAmount } from "@/lib/transaction-kinds";
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
  /** Lines just written, shown fresh. */
  highlight?: number[];
}) {
  if (entries.length === 0) return <p className="muted">Aucune écriture pour l&apos;instant.</p>;
  // The lines of one entry form a block; what they share is written on its first line.
  const positions = entryPositions(entries, (e) => e.cancelledAt == null && e.tillPending);
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
          {entries.map((e, i) => {
            const place = positions[i];
            const shared = (text: ReactNode) =>
              place.first ? text : <span className="sr-only">{text}</span>;
            const sale = e.kind === "vente";
            const cash = isCashKind(e.kind);
            const amount = signedAmount(e.kind, e.amount);
            const cancelled = e.cancelledAt != null;
            const mine = member.role === "gerant" || e.memberId === member.id;
            const canCancel = !cancelled && mine;
            // Its septims are not in the till yet: shown, but not counted.
            const waiting = !cancelled && e.tillPending;
            const label = cash ? `le mouvement de caisse n°${e.id}` : sale ? `la vente n°${e.id}` : `l'achat n°${e.id}`;
            return (
              <tr
                key={e.id}
                className={
                  [
                    ...entryClasses(place),
                    ...(cancelled ? ["cancelled"] : highlight?.includes(e.id) ? ["fresh"] : []),
                  ].join(" ") || undefined
                }
                data-testid={`ligne-${e.id}`}
              >
                <td className="num">{shared(dateTime.format(e.createdAt))}</td>
                <td>{shared(<OperationBadge kind={e.kind} />)}</td>
                <td>{e.label}</td>
                <td className="num">{cash ? "—" : formatNumber(e.quantity)}</td>
                <td className={`num ${cancelled ? "" : waiting ? "muted" : amount >= 0 ? "plus" : "minus"}`}>
                  {septims(amount, { signed: true })}
                  {waiting && (
                    <>
                      <br />
                      <TillPendingBadge />
                    </>
                  )}
                </td>
                <td>{shared(e.counterparty ?? "—")}</td>
                <td>{shared(e.member)}</td>
                {showNotes && <td className="small">{shared(e.notes ?? "")}</td>}
                <td>
                  {cancelled ? (
                    <span className="small muted">Annulée{e.cancelledBy ? ` par ${e.cancelledBy}` : ""}</span>
                  ) : (
                    canCancel && (
                      <div className="row-actions">
                        {waiting && place.settles && <SettleButton id={e.id} sale={sale} entry={e} />}
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
                      </div>
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
