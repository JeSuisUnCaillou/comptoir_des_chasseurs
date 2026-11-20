import { EntryButtons, LineButtons, hasEntryButtons, hasLineButtons } from "@/components/entry-buttons";
import { AmountCell, CancelledNote, DateCell, KindCell, PartyCell, entryPlace } from "@/components/entry-cells";
import { SettleButton } from "@/components/settle-button";
import type { MemberRole } from "@/lib/db/schema";
import { entryClasses, entryPlaces, entryPositions, entryTotals } from "@/lib/entry-groups";
import { formatNumber } from "@/lib/pricing";
import { counterpartyLabel, isCashKind, signedAmount } from "@/lib/transaction-kinds";
import type { RegisterEntry } from "@/lib/register";
import { canActOn } from "@/lib/policies";

export function RegisterTable({
  entries,
  member,
  shopSlug,
  showNotes = true,
  highlight,
}: {
  entries: RegisterEntry[];
  member: { id: number; role: MemberRole };
  /** The shop's address, for the link that edits a line's septims. */
  shopSlug: string;
  showNotes?: boolean;
  /** Lines just written, shown fresh. */
  highlight?: number[];
}) {
  if (entries.length === 0) return <p className="muted">Aucune écriture pour l&apos;instant.</p>;
  // The lines of one entry form a block; what they share is written on its first line.
  const positions = entryPositions(entries, (e) => e.cancelledAt == null && e.tillPending);
  const totals = entryTotals(entries, positions, (e) => (e.entrySum == null ? null : signedAmount(e.kind, e.entrySum)));
  // The buttons acting on a whole entry go where its total goes, under it:
  // on a phone card, "Tout annuler" at the bottom under the total, while each
  // line's own "Annuler" stays under its price.
  const buttonPlaces = entryPlaces(entries, positions, (e) => hasEntryButtons(e, canActOn(member, e)));
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
            const cash = isCashKind(e.kind);
            const cancelled = e.cancelledAt != null;
            const mine = canActOn(member, e);
            // Its septims are not in the till yet: shown, but not counted.
            const waiting = !cancelled && e.tillPending;
            const settles = waiting && mine && place.settles;
            const buttons = mine && hasLineButtons(e);
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
                <PartyCell
                  party={e.counterparty}
                  label={counterpartyLabel(e.kind)}
                  total={totals[i]}
                  place={place}
                  actions={buttonPlaces[i] && <EntryButtons entry={e} where={buttonPlaces[i]} shopSlug={shopSlug} />}
                />
                <td className={`cell-member${rep}`} data-label="Employé">
                  {shared(e.member)}
                </td>
                {showNotes && <td className={`small cell-notes${rep}`}>{shared(e.notes ?? "")}</td>}
                <td className="cell-actions">
                  {(cancelled || settles || buttons || e.editedBy) && (
                    <div className="row-actions">
                      {cancelled && <CancelledNote by={e.cancelledBy} beside />}
                      {!cancelled && e.editedBy && <span className="small muted">Modifiée par {e.editedBy}</span>}
                      {settles && <SettleButton id={e.id} kind={e.kind} entry={e} />}
                      {buttons && <LineButtons line={e} shopSlug={shopSlug} />}
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

