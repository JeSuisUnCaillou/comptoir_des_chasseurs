import { CancelButton } from "@/components/cancel-button";
import { AmountCell, CancelledNote, DateCell, KindCell, PartyCell, entryPlace } from "@/components/entry-cells";
import { SettleButton } from "@/components/settle-button";
import type { Member } from "@/lib/db/schema";
import { entryClasses, entryPositions, entryTotals } from "@/lib/entry-groups";
import { formatNumber } from "@/lib/pricing";
import { counterpartyLabel, isCashKind, signedAmount } from "@/lib/transaction-kinds";
import type { RegisterEntry } from "@/lib/register";
import { canActOn } from "@/lib/policies";

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
            const { shared, rep } = entryPlace(place);
            const sale = e.kind === "vente";
            const cash = isCashKind(e.kind);
            const cancelled = e.cancelledAt != null;
            const mine = canActOn(member, e);
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
                <DateCell at={e.createdAt} place={place} />
                <KindCell kind={e.kind} place={place} />
                <td className="cell-label">{e.label}</td>
                <td className={`num cell-qty${cash ? " cell-none" : ""}`}>{cash ? "—" : formatNumber(e.quantity)}</td>
                <AmountCell money={signedAmount(e.kind, e.amount)} cancelled={cancelled} waiting={waiting} />
                <PartyCell party={e.counterparty} label={counterpartyLabel(e.kind)} total={totals[i]} place={place} />
                <td className={`cell-member${rep}`} data-label="Employé">
                  {shared(e.member)}
                </td>
                {showNotes && <td className={`small cell-notes${rep}`}>{shared(e.notes ?? "")}</td>}
                <td className="cell-actions">
                  {cancelled ? (
                    <CancelledNote by={e.cancelledBy} />
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
