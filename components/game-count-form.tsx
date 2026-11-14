"use client";

import { Check, ImageUp, RotateCcw } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { recordGameCount, type MoveState } from "@/app/[boutique]/inventaire/actions";
import { matchProduct, MAX_COUNT_LINES, parsePage, stitchPages, sumByProduct, sumItems, type ReadItem } from "@/lib/game-count";
import { formatNumber, plural } from "@/lib/pricing";

export type CountProduct = { id: number; name: string; unit: string; stock: number };

/** An item of the chest under review: the merchandise it is ("" to ignore it) and its count. */
type Row = ReadItem & { productId: string; counted: string };

// Where the item names are on a 16:9 screenshot of a chest (SkyUI), as
// fractions of its width and height: below the headers, left of the Type column.
const NAMES = { left: 0.039, top: 0.165, width: 0.292, height: 0.662 };

/** The names column of a screenshot, twice as big, in black on white: what the OCR reads best. */
async function namesColumn(file: File) {
  const bitmap = await createImageBitmap(file);
  const sx = Math.round(bitmap.width * NAMES.left);
  const sy = Math.round(bitmap.height * NAMES.top);
  const sw = Math.round(bitmap.width * NAMES.width);
  const sh = Math.round(bitmap.height * NAMES.height);
  const canvas = document.createElement("canvas");
  canvas.width = sw * 2;
  canvas.height = sh * 2;
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const light = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = light > 140 ? 0 : 255;
    px[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** The OCR text of each screenshot, in their order, reading them in the browser. */
async function readScreenshots(files: File[], onProgress: (done: number) => void) {
  const { createWorker } = await import("tesseract.js");
  // Served by the app (scripts/copy-ocr-assets.mjs), never by a CDN.
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker("fra", 1, { workerPath: `${base}/worker.min.js`, corePath: base, langPath: base });
  try {
    // One block of uniform lines: the list of the chest.
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
    const texts: string[] = [];
    for (const file of files) {
      const { data } = await worker.recognize(await namesColumn(file));
      texts.push(data.text);
      onProgress(texts.length);
    }
    return texts;
  } finally {
    await worker.terminate();
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
}: {
  products: CountProduct[];
  aliases: { name: string; productId: number }[];
}) {
  const [state, action, pending] = useActionState<MoveState, FormData>(recordGameCount, null);
  const [reading, setReading] = useState<{ done: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  // A new file field after « Recommencer », so the same screenshots can be read again.
  const [fieldKey, setFieldKey] = useState(0);
  // Screenshots picked before the page is ready would be lost: the field waits for it.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  async function read(list: FileList | null) {
    // Screenshots are taken while scrolling down: their names keep that order (ScreenShot138, 139…).
    const files = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (files.length === 0) return;
    setError(null);
    setRows(null);
    setReading({ done: 0, of: files.length });
    try {
      const texts = await readScreenshots(files, (done) => setReading({ done, of: files.length }));
      const items = sumItems(stitchPages(texts.map(parsePage))).slice(0, MAX_COUNT_LINES);
      if (items.length === 0) {
        setError("Aucun objet lu sur ces captures. Prends-les en plein écran, sur la liste d'un coffre.");
      } else {
        setRows(
          items.map((item) => ({
            ...item,
            productId: String(matchProduct(item.name, products, aliases)?.id ?? ""),
            counted: String(item.total),
          })),
        );
      }
    } catch {
      setError("La lecture des captures a échoué. Recharge la page et réessaie.");
    } finally {
      setReading(null);
    }
  }

  function update(key: string, change: Partial<Row>) {
    setRows((all) => all && all.map((r) => (r.key === key ? { ...r, ...change } : r)));
  }

  const totals = sumByProduct(
    (rows ?? []).filter((r) => r.productId).map((r) => ({ productId: r.productId, counted: Number(r.counted) || 0 })),
  );
  const productOf = (row: Row) => products.find((p) => String(p.id) === row.productId);

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
      {rows && (
        <form action={action} aria-label="Relire le comptage">
          <p className="muted">
            Vérifie chaque objet lu : la marchandise qu&apos;il est et son compte. Un objet laissé sur « Ignorer » ne change
            rien, et une marchandise absente du coffre garde son stock.
          </p>
          <div className="count-lines">
            {rows.map((row, index) => {
              const product = productOf(row);
              const total = product ? totals.get(row.productId)! : 0;
              const gap = product ? total - product.stock : 0;
              const shared = product && rows.filter((r) => r.productId === row.productId).length > 1;
              const id = `c-${index}`;
              return (
                <fieldset key={row.key} className="tx-line count-line" aria-label={row.name}>
                  <input type="hidden" name="readName" value={row.name} />
                  <div className="count-read">
                    <strong>{row.name}</strong>{" "}
                    <span className="small muted">
                      lu : {row.counts.map(formatNumber).join(" + ")}
                    </span>
                  </div>
                  <div className="count-line-row">
                    <div className="field">
                      <label htmlFor={`${id}-product`}>Marchandise</label>
                      <select
                        id={`${id}-product`}
                        name="productId"
                        value={row.productId}
                        onChange={(ev) => update(row.key, { productId: ev.target.value })}
                      >
                        <option value="">Ignorer</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`${id}-counted`}>Compté</label>
                      <input
                        id={`${id}-counted`}
                        name="counted"
                        type="number"
                        min={0}
                        step={1}
                        required
                        value={row.counted}
                        onChange={(ev) => update(row.key, { counted: ev.target.value })}
                      />
                    </div>
                  </div>
                  {product && (
                    <p className="small muted count-gap" data-testid="ecart">
                      En stock : <strong className="tx-figure">{formatNumber(product.stock)}</strong> → compté :{" "}
                      <strong className="tx-figure">{formatNumber(total)}</strong>
                      {shared && " (avec les autres objets de cette marchandise)"} ·{" "}
                      <strong className={gap < 0 ? "minus" : undefined}>
                        {gap === 0 ? "aucun écart" : `${gap > 0 ? "+" : "−"}${formatNumber(Math.abs(gap))} ${plural(product.unit, Math.abs(gap))}`}
                      </strong>
                    </p>
                  )}
                </fieldset>
              );
            })}
          </div>
          <div className="field">
            <label htmlFor="c-reason">Motif</label>
            <input id="c-reason" name="reason" required maxLength={200} defaultValue="Comptage du coffre" />
          </div>
          {state && (
            <p className={`notice ${state.ok ? "" : "error"}`} role={state.ok ? "status" : "alert"}>
              {state.message}
            </p>
          )}
          <div className="move-actions">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              <Check size={16} /> Mettre le stock à jour
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => {
                setRows(null);
                setFieldKey((k) => k + 1);
              }} disabled={pending}>
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
