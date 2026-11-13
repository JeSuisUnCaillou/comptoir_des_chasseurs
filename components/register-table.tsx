import type { ReactNode } from "react";
import { CancelButton } from "@/components/cancel-button";
import { OperationBadge, TillPendingBadge } from "@/components/operation-badge";
import { SettleButton } from "@/components/settle-button";
import type { Member } from "@/lib/db/schema";
import { entryClasses, entryPositions, entryTotals } from "@/lib/entry-groups";
import { EntryTotal } from "@/components/entry-total";
import { formatNumber, septims } from "@/lib/pricing";
import { counterpartyLabel, isCashKind, signedAmount } from "@/lib/transaction-kinds";
import type { RegisterEntry } from "@/lib/register";
import { canActOn } from "@/lib/policies";

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
  const totals = entryTotals(entries, positions, (e) => (e.entrySum == null ? null : signedAmount(e.kind, e.entrySum)));
  return (
    <div className="table-wrap">
      <table className="entry-cards" data-testid="registre">
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
            const mine = canActOn(member, e);
            const canCancel = !cancelled && mine;
            // Its septims are not in the till yet: shown, but not counted.
            const waiting = !cancelled && e.tillPending;
            // On a phone each line is a card (see `.entry-cards` in globals.css); a shared
            // cell repeated on a later line stays for screen readers only.
            const rep = place.first ? "" : " cell-repeat";
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
                <td className={`num cell-date${rep}`}>{shared(dateTime.format(e.createdAt))}</td>
                <td className={`cell-kind${rep}`}>{shared(<OperationBadge kind={e.kind} />)}</td>
                <td className="cell-label">{e.label}</td>
                <td className={`num cell-qty${cash ? " cell-none" : ""}`}>{cash ? "—" : formatNumber(e.quantity)}</td>
                <td className={`num cell-amount ${cancelled ? "" : waiting ? "muted" : amount >= 0 ? "plus" : "minus"}`}>
                  {septims(amount, { signed: true })}
                  {waiting && (
                    <>
                      <br />
                      <TillPendingBadge />
                    </>
                  )}
                </td>
                <td className={`cell-party${rep}${e.counterparty || totals[i] != null ? "" : " cell-none"}`} data-label={counterpartyLabel(e.kind)}>
                  {shared(e.counterparty ?? "—")}
                  <EntryTotal total={totals[i]} />
                </td>
                <td className={`cell-member${rep}`} data-label="Employé">
                  {shared(e.member)}
                </td>
                {showNotes && <td className={`small cell-notes${rep}`}>{shared(e.notes ?? "")}</td>}
                <td className="cell-actions">
                  {cancelled ? (
                    <span className="small muted">Annulée{e.cancelledBy ? ` par ${e.cancelledBy}` : ""}</span>
                  ) : (
                    canCancel && (
                      <div className="row-actions">
                        {waiting && place.settles && <SettleButton id={e.id} kind={e.kind} entry={e} />}
                        <CancelButton
                          id={e.id}
                          label={label}
                          effect={
                            cash
                              ? "L'argent est retiré de la caisse."
                              : e.productId == null
                                ? "Le stock ne change pas."
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
