import { CancelButton } from "@/components/cancel-button";
import { AmountCell, CancelledNote, DateCell, KindCell, PartyCell, entryPlace } from "@/components/entry-cells";
import { SettleButton } from "@/components/settle-button";
import type { MemberRole } from "@/lib/db/schema";
import {
  entryClasses,
  entryPlaceClasses,
  entryPlaces,
  entryPositions,
  entryTotals,
  type EntryPlace,
} from "@/lib/entry-groups";
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
  member: { id: number; role: MemberRole };
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
  const buttonPlaces = entryPlaces(entries, positions, (e) => hasEntryButtons(e, member));
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
                <PartyCell
                  party={e.counterparty}
                  label={counterpartyLabel(e.kind)}
                  total={totals[i]}
                  place={place}
                  actions={buttonPlaces[i] && <EntryButtons entry={e} where={buttonPlaces[i]} />}
                />
                <td className={`cell-member${rep}`} data-label="Employé">
                  {shared(e.member)}
                </td>
                {showNotes && <td className={`small cell-notes${rep}`}>{shared(e.notes ?? "")}</td>}
                <td className="cell-actions">
                  {(cancelled || mine) && (
                    <div className="row-actions">
                      {cancelled && <CancelledNote by={e.cancelledBy} beside />}
                      {waiting && mine && place.settles && <SettleButton id={e.id} kind={e.kind} entry={e} />}
                      {mine &&
                        (cancelled ? (
                          <CancelButton
                            restore
                            id={e.id}
                            text="Rétablir"
                            name={`Rétablir ${label}`}
                            question={`Rétablir ${label} ? ${restoreEffect(e, sale, cash)}`}
                          />
                        ) : (
                          <CancelButton
                            id={e.id}
                            text="Annuler"
                            name={`Annuler ${label}`}
                            question={`Annuler ${label} ? ${cash ? "L'argent est retiré de la caisse." : stockEffect(e, sale)}`}
                          />
                        ))}
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

/** What cancelling the line does to the stock: what it really moved, not what it says. */
function stockEffect(e: RegisterEntry, sale: boolean) {
  if (e.stockBack === 0) return "Le stock ne change pas.";
  return sale ? `${e.stockBack} ${e.label} reviendront en stock.` : `${e.stockBack} ${e.label} sortiront du stock.`;
}

/** What restoring the line does: like writing it again. */
function restoreEffect(e: RegisterEntry, sale: boolean, cash: boolean) {
  if (cash) return "Le mouvement compte à nouveau.";
  if (e.productId == null) return "Le stock ne change pas.";
  return sale
    ? `${e.quantity} ${e.label} sortiront à nouveau du stock, autant qu'il en reste.`
    : `${e.quantity} ${e.label} reviendront en stock.`;
}

/** "cette vente", "cet achat"…: an entry of several lines. */
function entryName(kind: RegisterEntry["kind"]) {
  return kind === "vente" ? "cette vente" : kind === "rachat" ? "cet achat" : "cette écriture";
}

/** Every line still counted of the entry, and every cancelled one, as "quantity × label". */
function entryItems(e: RegisterEntry) {
  return {
    active: e.entryActiveItems ? e.entryActiveItems.split("\n") : [],
    cancelled: e.entryCancelledItems ? e.entryCancelledItems.split("\n") : [],
  };
}

/** Whether the member gets a button acting on the whole entry: at least two lines to change. */
function hasEntryButtons(e: RegisterEntry, member: { id: number; role: MemberRole }) {
  const { active, cancelled } = entryItems(e);
  return canActOn(member, e) && (active.length > 1 || cancelled.length > 1);
}

/**
 * On an entry of several lines, under its total, the buttons that cancel
 * every line still counted, or restore every cancelled one, in one click.
 * `where` places them like the total (see `entryPlaces`).
 */
function EntryButtons({ entry: e, where }: { entry: RegisterEntry; where: EntryPlace }) {
  const { active, cancelled } = entryItems(e);
  const name = entryName(e.kind);
  const list = (items: string[]) => items.map((item) => `• ${item}`).join("\n");
  const sale = e.kind === "vente";
  return (
    <span className={`entry-actions ${entryPlaceClasses(where)}`}>
      {active.length > 1 && (
        <CancelButton
          whole
          id={e.id}
          text="Tout annuler"
          name={`Tout annuler : les ${active.length} lignes de ${name}`}
          question={`Annuler les ${active.length} lignes de ${name} ?\n\n${list(active)}\n\n${
            sale ? "Ce qui est sorti du stock y revient." : "Ce qui est entré en stock en ressort."
          }`}
        />
      )}
      {cancelled.length > 1 && (
        <CancelButton
          whole
          restore
          id={e.id}
          text="Tout rétablir"
          name={`Tout rétablir : les ${cancelled.length} lignes de ${name}`}
          question={`Rétablir les ${cancelled.length} lignes de ${name} ?\n\n${list(cancelled)}\n\n${
            sale
              ? "Les marchandises sortiront à nouveau du stock, autant qu'il en reste."
              : "Les marchandises reviendront en stock."
          }`}
        />
      )}
    </span>
  );
}
