import Link from "next/link";
import { CancelButton } from "@/components/cancel-button";
import type { TransactionKind } from "@/lib/db/schema";
import { shopPath } from "@/lib/paths";
import { isCashKind } from "@/lib/transaction-kinds";

/**
 * The buttons that change register lines and stock movements made by hand,
 * in the register, the Inventaire's history and on a member's activity page
 * alike, shown only to whom may act on them (`canActOn`). An entry with two
 * lines or more still counted gets, on its first line, where a single line
 * has its own, « Modifier les transactions » and « Tout annuler », and its
 * lines no button of their own; otherwise its line has Modifier and Annuler.
 * Likewise two cancelled lines or more get « Tout rétablir », a single one
 * Rétablir.
 */
export type ButtonLine = {
  id: number;
  /** A register line's kind, or "stock" for a movement made by hand. */
  kind: TransactionKind | "stock";
  label: string;
  /** Units: signed (+ in, − out) for a stock movement. */
  quantity: number;
  productId: number | null;
  /** Units cancelling a register line puts back in stock (or takes out, for a buyback). */
  stockBack: number;
  cancelledAt: Date | null;
  /** "quantity × label" per line of its entry still counted, and per line cancelled, one per text line. */
  entryActiveItems: string;
  entryCancelledItems: string;
};

/**
 * On one line, unless its entry has the buttons (see above): Modifier and
 * Annuler while it counts, Rétablir once cancelled. `back`, a page of the
 * app, is where editing comes back to (the register or the Inventaire when none).
 */
export function LineButtons({ line: e, shopSlug, back }: { line: ButtonLine; shopSlug: string; back?: string }) {
  if (!hasLineButtons(e)) return null;
  const stock = e.kind === "stock";
  const label = lineName(e);
  if (e.cancelledAt != null) {
    return (
      <CancelButton
        restore
        stock={stock}
        id={e.id}
        text="Rétablir"
        name={`Rétablir ${label}`}
        question={`Rétablir ${label} ? ${restoreEffect(e)}`}
      />
    );
  }
  return (
    <>
      <Link className="btn btn-small btn-ghost" href={editPath(e, shopSlug, back)} aria-label={`Modifier ${label}`}>
        Modifier
      </Link>
      <CancelButton
        stock={stock}
        id={e.id}
        text="Annuler"
        name={`Annuler ${label}`}
        question={`Annuler ${label} ? ${cancelEffect(e)}`}
      />
    </>
  );
}

/** "la vente n°12", "le mouvement de stock n°40"… */
function lineName(e: ButtonLine) {
  if (e.kind === "stock") return `le mouvement de stock n°${e.id}`;
  if (isCashKind(e.kind)) return `le mouvement de caisse n°${e.id}`;
  return e.kind === "vente" ? `la vente n°${e.id}` : `l'achat n°${e.id}`;
}

/** Whether the line has buttons of its own, its entry not carrying them. */
export function hasLineButtons(e: ButtonLine) {
  const { active, cancelled } = entryItems(e);
  return e.cancelledAt != null ? cancelled.length <= 1 : active.length <= 1;
}

/** The page changing the entry holding line `e`, coming back to `back`. */
function editPath(e: ButtonLine, shopSlug: string, back?: string) {
  const page = e.kind === "stock" ? "/inventaire/modifier" : "/achat-vente/modifier";
  return shopPath(shopSlug, `${page}/${e.id}${back ? `?retour=${encodeURIComponent(back)}` : ""}`);
}

/** What cancelling the line does: for a sale or buyback, what it really moved, not what it says. */
function cancelEffect(e: ButtonLine) {
  if (e.kind === "stock") {
    const units = `${Math.abs(e.quantity)} ${e.label}`;
    return e.quantity > 0 ? `${units} ressortiront du stock.` : `${units} reviendront en stock.`;
  }
  if (isCashKind(e.kind)) return "L'argent est retiré de la caisse.";
  if (e.stockBack === 0) return "Le stock ne change pas.";
  return e.kind === "vente"
    ? `${e.stockBack} ${e.label} reviendront en stock.`
    : `${e.stockBack} ${e.label} sortiront du stock.`;
}

/** What restoring the line does: like writing it again. */
function restoreEffect(e: ButtonLine) {
  if (e.kind === "stock") {
    const units = `${Math.abs(e.quantity)} ${e.label}`;
    return e.quantity > 0 ? `${units} reviendront en stock.` : `${units} ressortiront du stock.`;
  }
  if (isCashKind(e.kind)) return "Le mouvement compte à nouveau.";
  if (e.productId == null) return "Le stock ne change pas.";
  return e.kind === "vente"
    ? `${e.quantity} ${e.label} sortiront à nouveau du stock, autant qu'il en reste.`
    : `${e.quantity} ${e.label} reviendront en stock.`;
}

/** "cette vente", "cet achat"…: an entry of several lines. */
function entryName(kind: ButtonLine["kind"]) {
  if (kind === "stock") return "ce mouvement de stock";
  return kind === "vente" ? "cette vente" : kind === "rachat" ? "cet achat" : "cette écriture";
}

/** Every line still counted of the entry, and every cancelled one, as "quantity × label". */
function entryItems(e: ButtonLine) {
  return {
    active: e.entryActiveItems ? e.entryActiveItems.split("\n") : [],
    cancelled: e.entryCancelledItems ? e.entryCancelledItems.split("\n") : [],
  };
}

/**
 * Whether a member who may act on the entry (`mine`, see `canActOn`) gets
 * buttons acting on all of it: at least two lines to change.
 */
export function hasEntryButtons(e: ButtonLine, mine: boolean) {
  const { active, cancelled } = entryItems(e);
  return mine && (active.length > 1 || cancelled.length > 1);
}

/** What cancelling every line of an entry does to the stock. */
export function wholeStockEffect(kind: ButtonLine["kind"]) {
  if (kind === "stock") return "Ce qui est entré en stock en ressort, ce qui en est sorti y revient.";
  return kind === "vente" ? "Ce qui est sorti du stock y revient." : "Ce qui est entré en stock en ressort.";
}

/** What restoring every cancelled line of an entry does to the stock. */
function wholeRestoreEffect(kind: ButtonLine["kind"]) {
  if (kind === "stock") return "Les marchandises entrent ou sortent à nouveau du stock, comme la première fois.";
  return kind === "vente"
    ? "Les marchandises sortiront à nouveau du stock, autant qu'il en reste."
    : "Les marchandises reviendront en stock.";
}

/**
 * On the first line of an entry of several, among its buttons: change every
 * line still counted, cancel them all, or restore every cancelled one, in one
 * click.
 */
export function EntryButtons({
  entry: e,
  shopSlug,
  back,
}: {
  entry: ButtonLine;
  shopSlug: string;
  back?: string;
}) {
  const { active, cancelled } = entryItems(e);
  const name = entryName(e.kind);
  const stock = e.kind === "stock";
  const list = (items: string[]) => items.map((item) => `• ${item}`).join("\n");
  return (
    <div className="entry-buttons">
      {active.length > 1 && (
        <Link
          className="btn btn-small btn-ghost"
          href={editPath(e, shopSlug, back)}
          aria-label={`Modifier les transactions : les ${active.length} lignes de ${name}`}
        >
          Modifier les transactions
        </Link>
      )}
      {active.length > 1 && (
        <CancelButton
          whole
          stock={stock}
          id={e.id}
          text="Tout annuler"
          name={`Tout annuler : les ${active.length} lignes de ${name}`}
          question={`Annuler les ${active.length} lignes de ${name} ?\n\n${list(active)}\n\n${wholeStockEffect(e.kind)}`}
        />
      )}
      {cancelled.length > 1 && (
        <CancelButton
          whole
          restore
          stock={stock}
          id={e.id}
          text="Tout rétablir"
          name={`Tout rétablir : les ${cancelled.length} lignes de ${name}`}
          question={`Rétablir les ${cancelled.length} lignes de ${name} ?\n\n${list(cancelled)}\n\n${wholeRestoreEffect(e.kind)}`}
        />
      )}
    </div>
  );
}
