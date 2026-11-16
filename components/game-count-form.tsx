"use client";

import { AlertTriangle, Check, ImageUp, RotateCcw, ScanSearch } from "lucide-react";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { recordGameCount, type MoveState } from "@/app/[boutique]/inventaire/actions";
import { ProductCombobox, choicesByCategory } from "@/components/product-combobox";
import type { CategorizedProduct } from "@/lib/products";
import {
  countChecks,
  countedProducts,
  NEW_PRODUCT,
  normalizeName,
  proposeProducts,
  readingWarnings,
  splitForCount,
  stitchPages,
  sumItems,
  type CountCheck,
  type ReadItem,
  type ReviewedItem,
} from "@/lib/game-count";
import { LineStrip, readScreenshots } from "@/components/game-count-reading";
import { formatNumber } from "@/lib/pricing";

export type CountProduct = Pick<CategorizedProduct, "id" | "name" | "stock" | "categoryId" | "categoryName" | "categoryPosition">;

/** The choices that are not a merchandise of the shop: leave the item out, or create its merchandise. */
const EXTRAS = [
  { id: "", name: "Ignorer" },
  { id: NEW_PRODUCT, name: "Nouvelle marchandise" },
];

/**
 * An item of the chest under review: the merchandise it is ("" to ignore it,
 * NEW_PRODUCT to create it as `newName` in `categoryId`) and its count.
 * `recognized`: the app found its merchandise when reading; it keeps the
 * item in its section while the gérant changes it. `guessed`: the merchandise
 * is only the closest name, until the gérant confirms it. `doubtful`: the
 * OCR was not sure of a count, until the gérant checks it. `n`: its place in
 * the reading, for the ids of its fields.
 */
type Row = ReadItem &
  ReviewedItem & {
    recognized: boolean;
    newName: string;
    categoryId: string;
  };

/** A check before writing, in words. */
function checkText(check: CountCheck) {
  switch (check.kind) {
    case "guessed":
      return `${check.item} : rattaché à ${check.product} par un nom approchant.`;
    case "doubtful":
      return `${check.item} : un nombre peut-être mal lu.`;
    case "gap":
      return `${check.product} : ${formatNumber(check.stock)} en stock, ${formatNumber(check.counted)} comptés.`;
  }
}

/**
 * Counts a chest of the game from screenshots of its inventory: reads them,
 * shows each item with the merchandise it is and its count, and once the
 * gérant has checked them, sets the stock to the counts.
 */
export function GameCountForm({
  products,
  aliases,
  categories,
}: {
  products: CountProduct[];
  aliases: { name: string; productId: number }[];
  categories: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState<MoveState, FormData>(recordGameCount, null);
  const [reading, setReading] = useState<{ done: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  // The items whose lines of screenshot are shown.
  const [shown, setShown] = useState<Set<number>>(new Set());
  // The checks shown before writing, once the gérant asked to write.
  const [checking, setChecking] = useState(false);
  const confirmed = useRef(false);
  const [bulkCategory, setBulkCategory] = useState(String(categories[0]?.id ?? ""));
  // A new file field after « Recommencer », so the same screenshots can be read again.
  const [fieldKey, setFieldKey] = useState(0);
  // Screenshots picked before the page is ready would be lost: the field waits for it.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // Merchandises just created, without stock to write: their items now are them, not new ones again.
  useEffect(() => {
    if (!state?.ok) return;
    setRows((all) =>
      all?.map((r) => {
        if (r.productId !== NEW_PRODUCT) return r;
        const made = products.find((p) => normalizeName(p.name) === normalizeName(r.newName));
        return made ? { ...r, productId: String(made.id) } : r;
      }) ?? null,
    );
  }, [state, products]);

  async function read(list: FileList | null) {
    // Screenshots are taken while scrolling down: their names keep that order (ScreenShot138, 139…).
    const sorted = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (sorted.length === 0) return;
    setError(null);
    setRows(null);
    setWarnings([]);
    setShown(new Set());
    setChecking(false);
    setFiles(sorted);
    setReading({ done: 0, of: sorted.length });
    try {
      const pages = await readScreenshots(sorted, (done) => setReading({ done, of: sorted.length }));
      const { lines, overlaps } = stitchPages(pages.map((p) => p.lines));
      const { kept: items, left } = splitForCount(sumItems(lines));
      setWarnings(readingWarnings(pages, overlaps, left));
      if (items.length === 0) {
        setError("Aucun objet lu sur ces captures. Prends-les en plein écran, sur la liste d'un coffre.");
        return;
      }
      const proposed = proposeProducts(items, products, aliases);
      setRows(
        items.map((item, n) => {
          const { product, guess } = proposed[n];
          return {
            ...item,
            n,
            productId: String(product?.id ?? guess?.id ?? ""),
            counted: String(item.total),
            recognized: Boolean(product),
            guessed: Boolean(guess),
            doubtful: item.lines.some((l) => l.doubtful),
            newName: item.name,
            categoryId: bulkCategory,
          };
        }),
      );
    } catch {
      setError("La lecture des captures a échoué. Recharge la page et réessaie.");
    } finally {
      setReading(null);
    }
  }

  function update(n: number, change: Partial<Row>) {
    confirmed.current = false;
    setRows((all) => all && all.map((r) => (r.n === n ? { ...r, ...change } : r)));
  }

  function toggleLines(row: Row) {
    setShown((all) => {
      const next = new Set(all);
      if (next.has(row.n)) next.delete(row.n);
      else next.add(row.n);
      return next;
    });
    // Seen on the screenshot: its counts are checked.
    if (row.doubtful) update(row.n, { doubtful: false });
  }

  const all = rows ?? [];
  const counted = countedProducts(all, products);
  const choices = choicesByCategory(products);
  const gapOf = (row: Row) => counted.get(row.productId);
  // What the gérant should look at before writing.
  const checks = countChecks(all, products).map((check) => ({ n: check.n, text: checkText(check) }));

  function submit(ev: FormEvent<HTMLFormElement>) {
    if (checks.length > 0 && !confirmed.current) {
      ev.preventDefault();
      setChecking(true);
    }
  }

  function goTo(n: number) {
    document.getElementById(`c-${n}`)?.focus();
  }

  /** One item on one row: what was read, its merchandise, its stock, its count, and the gap between them. */
  function itemLine(row: Row) {
    const gap = gapOf(row);
    const diff = gap ? gap.total - gap.product.stock : 0;
    const shared = gap && all.filter((r) => r.productId === row.productId).length > 1;
    const creating = row.productId === NEW_PRODUCT;
    const open = shown.has(row.n);
    return (
      <fieldset key={row.n} className="count-line" aria-label={row.name}>
        <input type="hidden" name="readName" value={row.name} />
        <button
          type="button"
          className="count-read"
          aria-expanded={open}
          aria-controls={`lines-${row.n}`}
          title="Voir les lignes lues sur les captures"
          onClick={() => toggleLines(row)}
        >
          <strong>{row.name}</strong>{" "}
          <span className="small muted nowrap">
            {row.lines.map((l) => formatNumber(l.count)).join(" + ")} <ScanSearch size={14} aria-label="Voir sur les captures" />
          </span>
        </button>
        <div className="count-product">
          <label className="sr-only" htmlFor={`c-${row.n}`}>
            Marchandise
          </label>
          <ProductCombobox
            id={`c-${row.n}`}
            name="productId"
            products={choices}
            extras={EXTRAS}
            value={row.productId}
            onChange={(productId) => update(row.n, { productId, guessed: false })}
          />
          {row.guessed && row.productId && (
            <button type="button" className="count-guess" onClick={() => update(row.n, { guessed: false })}>
              Proposée : confirmer
            </button>
          )}
        </div>
        <span className="count-stock" data-testid="stock">
          {gap ? formatNumber(gap.product.stock) : creating ? "0" : ""}
        </span>
        <input
          name="counted"
          aria-label="Compté"
          type="number"
          min={0}
          step={1}
          required
          className={row.doubtful ? "doubtful" : undefined}
          title={row.doubtful ? "Nombre peut-être mal lu : vérifie sur la capture" : undefined}
          value={row.counted}
          onChange={(ev) => update(row.n, { counted: ev.target.value, doubtful: false })}
        />
        <span
          className={`count-gap${gap?.big ? " big" : ""}`}
          data-testid="ecart"
          title={gap?.big ? "Gros écart : vérifie le compte" : shared ? "Compté avec les autres objets de cette marchandise" : undefined}
        >
          {gap && (
            <strong className={diff > 0 ? "plus" : diff < 0 ? "minus" : "muted"}>
              {gap.big && <AlertTriangle size={12} aria-label="Gros écart" />}
              {diff === 0 ? "=" : `${diff > 0 ? "+" : "−"}${formatNumber(Math.abs(diff))}`}
              {shared && "*"}
            </strong>
          )}
          {creating && <strong className="plus">+{formatNumber(Number(row.counted) || 0)}</strong>}
        </span>
        {creating ? (
          <div className="count-new">
            <label>
              Nom
              <input name="newName" required maxLength={100} value={row.newName} onChange={(ev) => update(row.n, { newName: ev.target.value })} />
            </label>
            <label>
              Catégorie
              <select name="categoryId" value={row.categoryId} onChange={(ev) => update(row.n, { categoryId: ev.target.value })}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <>
            <input type="hidden" name="newName" value="" />
            <input type="hidden" name="categoryId" value="" />
          </>
        )}
        {open && (
          <div className="count-strips" id={`lines-${row.n}`}>
            {row.lines.map((line, i) => (
              <LineStrip key={i} file={files[line.page!]} line={line} />
            ))}
          </div>
        )}
      </fieldset>
    );
  }

  /** The column titles of a section, for sighted readers: each field carries its own label. */
  const head = (
    <div className="count-head small muted" aria-hidden="true">
      <span>Lu dans le jeu</span>
      <span>Marchandise</span>
      <span className="count-num">En stock</span>
      <span>Compté</span>
      <span className="count-num">Écart</span>
    </div>
  );

  const unknown = all.filter((r) => !r.recognized);
  const known = all.filter((r) => r.recognized);
  const ignored = unknown.filter((r) => r.productId === "");
  const creating = unknown.filter((r) => r.productId === NEW_PRODUCT);

  return (
    <>
      <div className="field">
        <label htmlFor="c-screenshots">Captures du coffre</label>
        <input
          key={fieldKey}
          id="c-screenshots"
          type="file"
          accept="image/*"
          multiple
          disabled={!ready || reading != null || pending}
          onChange={(ev) => read(ev.target.files)}
        />
        <span className="small muted">
          En plein écran, de haut en bas de la liste : les lignes vues sur deux captures ne comptent qu&apos;une fois.
        </span>
      </div>
      {reading && (
        <p className="notice" role="status">
          Lecture des captures… {reading.done} / {reading.of}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {warnings.length > 0 && (
        <div className="notice warning" role="status" aria-label="À propos des captures">
          <strong>À propos des captures</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {rows && (
        <form action={action} onSubmit={submit} aria-label="Relire le comptage">
          <p className="small muted">
            Un objet sur « Ignorer » ne change rien ; une marchandise absente du coffre garde son stock. Touche un nom pour
            voir ses lignes sur les captures.
          </p>
          <div className="count-columns">
            {known.length > 0 && (
              <section className="count-section" aria-label="Objets reconnus">
                <h3>Reconnus ({known.length})</h3>
                <p className="small muted">Vérifie leur compte et l&apos;écart avec le stock.</p>
                {head}
                <div className="count-lines">{known.map((row) => itemLine(row))}</div>
              </section>
            )}
            {unknown.length > 0 && (
              <section className="count-section" aria-label="Objets non reconnus">
                <h3>Non reconnus ({unknown.length})</h3>
                <p className="small muted">
                  Choisis leur marchandise, crée-la, ou laisse « Ignorer ». Ton choix est retenu pour la prochaine fois.
                </p>
                {(ignored.length > 0 || creating.length > 0) && categories.length > 0 && (
                  <div className="count-bulk">
                    {ignored.length > 0 && (
                      <>
                        <label className="sr-only" htmlFor="c-bulk-category">
                          Catégorie des nouvelles marchandises
                        </label>
                        <select id="c-bulk-category" value={bulkCategory} onChange={(ev) => setBulkCategory(ev.target.value)}>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => {
                            for (const r of ignored) update(r.n, { productId: NEW_PRODUCT, categoryId: bulkCategory });
                          }}
                        >
                          Créer les {ignored.length} ignorés dans cette catégorie
                        </button>
                      </>
                    )}
                    {creating.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        onClick={() => {
                          for (const r of creating) update(r.n, { productId: "" });
                        }}
                      >
                        Ne plus créer les {creating.length} nouvelles
                      </button>
                    )}
                  </div>
                )}
                {head}
                <div className="count-lines">{unknown.map((row) => itemLine(row))}</div>
              </section>
            )}
          </div>
          <div className="field">
            <label htmlFor="c-reason">Motif</label>
            <input id="c-reason" name="reason" required maxLength={200} defaultValue="Régularisation du stock" />
          </div>
          {checking && checks.length > 0 && (
            <div className="notice warning" role="alert" aria-label="À vérifier avant d'inscrire">
              <strong>À vérifier avant d&apos;inscrire ({checks.length})</strong>
              <ul>
                {checks.map((c) => (
                  <li key={c.text}>
                    <button type="button" className="link-button" onClick={() => goTo(c.n)}>
                      {c.text}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="move-actions">
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={pending}
                  onClick={(ev) => {
                    confirmed.current = true;
                    ev.currentTarget.form?.requestSubmit();
                  }}
                >
                  <Check size={16} /> Inscrire quand même
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => setChecking(false)}>
                  Revenir à la relecture
                </button>
              </div>
            </div>
          )}
          {state && (
            <p className={`notice ${state.ok ? "" : "error"}`} role={state.ok ? "status" : "alert"}>
              {state.message}
            </p>
          )}
          <div className="move-actions">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              <Check size={16} /> Mettre le stock à jour
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setRows(null);
                setWarnings([]);
                setFieldKey((k) => k + 1);
              }}
              disabled={pending}
            >
              <RotateCcw size={16} /> Recommencer
            </button>
          </div>
        </form>
      )}
      {!rows && !reading && (
        <p className="small muted">
          <ImageUp size={14} style={{ verticalAlign: "-2px" }} /> La lecture se fait dans ton navigateur : les captures ne
          quittent pas ton ordinateur.
        </p>
      )}
    </>
  );
}
