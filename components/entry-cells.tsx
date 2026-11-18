import type { ReactNode } from "react";
import { EntryTotal } from "@/components/entry-total";
import { OperationBadge, TillPendingBadge } from "@/components/operation-badge";
import type { TransactionKind } from "@/lib/db/schema";
import type { EntryPosition, EntryTotal as Total } from "@/lib/entry-groups";
import { septims } from "@/lib/pricing";

/**
 * The cells the register and a member's activity share: an entry's date,
 * operation and client written once on its first line, the signed septims
 * with « pas encore en caisse », and who cancelled a line.
 */

const dateTime = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * How a row shows what its entry's lines share: written on the first line; on
 * a later one, kept for screen readers only. On a phone each line is a card
 * (see `.entry-cards` in globals.css), and `rep` hides that repeated cell.
 */
export function entryPlace(place: EntryPosition) {
  return {
    shared: (text: ReactNode) => (place.first ? text : <span className="sr-only">{text}</span>),
    rep: place.first ? "" : " cell-repeat",
  };
}

export function DateCell({ at, place }: { at: Date; place: EntryPosition }) {
  const { shared, rep } = entryPlace(place);
  return <td className={`num cell-date${rep}`}>{shared(dateTime.format(at))}</td>;
}

export function KindCell({ kind, place }: { kind: TransactionKind | "stock"; place: EntryPosition }) {
  const { shared, rep } = entryPlace(place);
  return <td className={`cell-kind${rep}`}>{shared(<OperationBadge kind={kind} />)}</td>;
}

/**
 * What a line did to the till, signed; « — » for a line without money. A line
 * waiting for the till shows its septims muted, not counted yet.
 */
export function AmountCell({ money, cancelled, waiting }: { money: number | null; cancelled: boolean; waiting: boolean }) {
  const tone = money == null || cancelled ? "" : waiting ? "muted" : money >= 0 ? "plus" : "minus";
  return (
    <td className={`num cell-amount${money == null ? " cell-none" : ""} ${tone}`}>
      {money == null ? "—" : septims(money, { signed: true })}
      {waiting && (
        <>
          <br />
          <TillPendingBadge />
        </>
      )}
    </td>
  );
}

/** The client or seller, written once per entry, with the entry's total under it. */
export function PartyCell({
  party,
  label,
  total,
  place,
}: {
  party: string | null;
  /** The cell's name on a phone card; none for a stock movement. */
  label: string | undefined;
  total: Total | null;
  place: EntryPosition;
}) {
  const { shared, rep } = entryPlace(place);
  return (
    <td className={`cell-party${rep}${party || total != null ? "" : " cell-none"}`} data-label={label}>
      {shared(party ?? "—")}
      <EntryTotal total={total} />
    </td>
  );
}

/** Who cancelled a line; `beside` keeps it on one line next to its Rétablir button. */
export function CancelledNote({ by, beside = false }: { by: string | null; beside?: boolean }) {
  return <span className={`small muted${beside ? " cancelled-by" : ""}`}>Annulée{by ? ` par ${by}` : ""}</span>;
}
