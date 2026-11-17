import type { ReactNode } from "react";
import { CancelButton } from "@/components/cancel-button";
import { OperationBadge, TillPendingBadge } from "@/components/operation-badge";
import { SettleButton } from "@/components/settle-button";
import type { MemberRole } from "@/lib/db/schema";
import { entryClasses, entryPositions, entryTotals, type EntryTotal as EntryTotalPlace } from "@/lib/entry-groups";
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
  member: { id: number; role: MemberRole };
  showNotes?: boolean;
  /** Lines just written, shown fresh. */
  highlight?: number[];
}) {
  if (entries.length === 0) return <p className="muted">Aucune écriture pour l&apos;instant.</p>;
  // The lines of one entry form a block; what they share is written on its first line.
  const positions = entryPositions(entries, (e) => e.cancelledAt == null && e.tillPending);
  const totals = entryTotals(entries, positions, (e) => (e.entrySum == null ? null : signedAmount(e.kind, e.entrySum)));
  // The buttons acting on a whole entry go where its total goes, beside it.
  const groups = entryTotals(entries, positions, (e) => (e.entryCount > 1 ? 0 : null));
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
            const shared = (text: ReactNode) => (place.first ? text : <span className="sr-only">{text}</span>);
            const sale = e.kind === "vente";
            const cash = isCashKind(e.kind);
            const amount = signedAmount(e.kind, e.amount);
            const cancelled = e.cancelledAt != null;
            const mine = canActOn(member, e);
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
                <td
                  className={`num cell-amount ${cancelled ? "" : waiting ? "muted" : amount >= 0 ? "plus" : "minus"}`}
                >
                  {septims(amount, { signed: true })}
                  {waiting && (
                    <>
                      <br />
                      <TillPendingBadge />
                    </>
                  )}
                </td>
                <td
                  className={`cell-party${rep}${e.counterparty || totals[i] != null || (mine && groups[i] != null) ? "" : " cell-none"}`}
                  data-label={counterpartyLabel(e.kind)}
                >
                  {shared(e.counterparty ?? "—")}
                  <EntryTotal total={totals[i]} />
                  {mine && <EntryButtons entry={e} where={groups[i]} />}
                </td>
                <td className={`cell-member${rep}`} data-label="Employé">
                  {shared(e.member)}
                </td>
                {showNotes && <td className={`small cell-notes${rep}`}>{shared(e.notes ?? "")}</td>}
                <td className="cell-actions">
                  {(cancelled || mine) && (
                    <div className="row-actions">
                      {cancelled && (
                        <span className="small muted cancelled-by">
                          Annulée{e.cancelledBy ? ` par ${e.cancelledBy}` : ""}
                        </span>
                      )}
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

/**
 * On an entry of several lines, beside its total, the buttons that cancel
 * every line still counted, or restore every cancelled one, in one click.
 * `where` places them like the total (see `entryTotals`).
 */
function EntryButtons({ entry: e, where }: { entry: RegisterEntry; where: EntryTotalPlace | null }) {
  if (where == null) return null;
  const active = e.entryActiveItems ? e.entryActiveItems.split("\n") : [];
  const cancelled = e.entryCancelledItems ? e.entryCancelledItems.split("\n") : [];
  const name = entryName(e.kind);
  const list = (items: string[]) => items.map((item) => `• ${item}`).join("\n");
  const sale = e.kind === "vente";
  if (active.length < 2 && cancelled.length < 2) return null;
  const place = [...(where.table ? ["on-table"] : []), ...(where.card ? ["on-card"] : [])].join(" ");
  return (
    <span className={`entry-actions ${place}`}>
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
