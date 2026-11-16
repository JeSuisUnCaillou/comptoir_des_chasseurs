"use client";

// Reading screenshots of a chest in the browser, in three parts: the layout
// of the game's screen (where its lines are), the OCR engine (tesseract.js,
// which gives OcrLine), and the loop over the screenshots. Then what to check
// about the screenshots, and a line cut from one. What is read is parsed by
// lib/game-count.ts, which knows nothing of the OCR engine.

import { useEffect, useRef } from "react";
import { normalizeName, parseOcrPage, type OcrLine, type ReadLine } from "@/lib/game-count";

/**
 * A screen of the game the app reads, and how: where its lines are on a
 * screenshot, how to make them readable, in which language. Fractions are of
 * the screenshot's width and height. Another screen of the game is another
 * layout; the reading itself does not change.
 */
type ScreenLayout = {
  /** The width / height of a full-screen screenshot of it, and how far from it one may be. */
  ratio: number;
  ratioTolerance: number;
  /** What the OCR reads: the item names. */
  names: { left: number; top: number; width: number; height: number };
  /** What a line shows to the gérant, from left to right; its height is the line's. */
  strip: { left: number; width: number };
  /** How many times the names are enlarged, and the light above which a pixel is a letter. */
  scale: number;
  threshold: number;
  /** The OCR's language data, served in public/ocr/ (scripts/copy-ocr-assets.mjs). */
  language: string;
};

/**
 * The list of a chest (SkyUI), on a 16:9 screenshot. The names are below
 * the headers, short of the Type column, whose long words ("Nourriture",
 * "Ingrédient") start at 0.317. Its thin letters are enlarged three times and
 * kept thick by a low threshold: at twice the size, "a" reads as "o"
 * ("Chair de ssumon").
 */
export const CHEST: ScreenLayout = {
  ratio: 16 / 9,
  ratioTolerance: 0.05,
  names: { left: 0.039, top: 0.165, width: 0.261, height: 0.662 },
  strip: { left: 0.02, width: 0.43 },
  scale: 3,
  threshold: 120,
  language: "fra",
};

/** Part of a screenshot, enlarged, in black on white: what the OCR reads best. */
function forOcr(bitmap: ImageBitmap, layout: ScreenLayout) {
  const area = layout.names;
  const sx = Math.round(bitmap.width * area.left);
  const sy = Math.round(bitmap.height * area.top);
  const sw = Math.round(bitmap.width * area.width);
  const sh = Math.round(bitmap.height * area.height);
  const canvas = document.createElement("canvas");
  canvas.width = sw * layout.scale;
  canvas.height = sh * layout.scale;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const light = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = light > layout.threshold ? 0 : 255;
    px[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** The OCR engine (tesseract.js), started for a layout's language. Served by the app, never by a CDN. */
async function startOcr(layout: ScreenLayout) {
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker(layout.language, 1, { workerPath: `${base}/worker.min.js`, corePath: base, langPath: base });
  // One block of uniform lines: the list.
  await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
  return worker;
}

type Ocr = Awaited<ReturnType<typeof startOcr>>;

/** The lines the OCR reads on a screenshot, with their top and bottom as fractions of its height. */
async function recognize(ocr: Ocr, bitmap: ImageBitmap, layout: ScreenLayout): Promise<OcrLine[]> {
  const { data } = await ocr.recognize(forOcr(bitmap, layout), {}, { blocks: true });
  // The boxes are in the enlarged names: back to fractions of the screenshot.
  const at = (y: number) => layout.names.top + y / layout.scale / bitmap.height;
  return (data.blocks ?? []).flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.map((line) => ({
        text: line.text,
        top: at(line.bbox.y0),
        bottom: at(line.bbox.y1),
        words: line.words.map((w) => ({ text: w.text, confidence: w.confidence })),
      })),
    ),
  );
}

/** What was read on one screenshot. */
export type Page = { file: File; ratio: number; lines: ReadLine[] };

/** Reads each screenshot of a chest in the browser, in their order. */
export async function readScreenshots(files: File[], onProgress: (done: number) => void, layout = CHEST): Promise<Page[]> {
  const ocr = await startOcr(layout);
  try {
    const pages: Page[] = [];
    for (const [page, file] of files.entries()) {
      const bitmap = await createImageBitmap(file);
      try {
        const lines = await recognize(ocr, bitmap, layout);
        pages.push({ file, ratio: bitmap.width / bitmap.height, lines: parseOcrPage(lines, page) });
      } finally {
        bitmap.close();
      }
      onProgress(pages.length);
    }
    return pages;
  } finally {
    await ocr.terminate();
  }
}

/**
 * What to check about the screenshots themselves: none read, not full
 * screen, or a page missing between two. The game sorts a list by name: a
 * screenshot that shares no line with the one before yet goes on in that
 * order is likely the same list, with a page skipped; one that starts over
 * is another tab.
 */
export function screenshotWarnings(pages: Page[], overlaps: number[], layout = CHEST) {
  const warnings: string[] = [];
  pages.forEach((page, i) => {
    const name = page.file.name;
    if (Math.abs(page.ratio - layout.ratio) > layout.ratioTolerance) {
      warnings.push(`${name} n'est pas une capture plein écran en 16:9 : ses lignes peuvent être mal lues.`);
    }
    if (page.lines.length === 0) {
      warnings.push(`${name} : aucun objet lu. Est-ce bien la liste d'un coffre, en plein écran ?`);
    }
    const last = pages[i - 1]?.lines.at(-1);
    const first = page.lines[0];
    if (last && first && overlaps[i] === 0 && normalizeName(first.name) > normalizeName(last.name)) {
      warnings.push(`${pages[i - 1].file.name} et ${name} n'ont aucune ligne en commun : une page manque peut-être entre les deux.`);
    }
  });
  return warnings;
}

/** A line of a screenshot as the game shows it, drawn from the screenshot itself. */
export function LineStrip({ file, line, layout = CHEST }: { file: File; line: ReadLine; layout?: ScreenLayout }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    createImageBitmap(file).then((bitmap) => {
      const canvas = ref.current;
      if (!live || !canvas) return bitmap.close();
      const pad = 0.004 * bitmap.height;
      const sx = bitmap.width * layout.strip.left;
      const sw = bitmap.width * layout.strip.width;
      const sy = Math.max(0, line.top! * bitmap.height - pad);
      const sh = Math.min(bitmap.height - sy, (line.bottom! - line.top!) * bitmap.height + 2 * pad);
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      bitmap.close();
    });
    return () => {
      live = false;
    };
  }, [file, line, layout]);
  return <canvas ref={ref} className="count-strip" role="img" aria-label={`Sur ${file.name} : ${line.name}${line.count > 1 ? ` (${line.count})` : ""}`} />;
}

