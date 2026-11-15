"use client";

// Reading screenshots of a chest in the browser: where things are on them,
// the OCR, what to check about the screenshots, and a line cut from one.
// What is read is parsed by lib/game-count.ts.

import { useEffect, useRef } from "react";
import { normalizeName, parseOcrPage, type OcrLine, type ReadLine } from "@/lib/game-count";

// Where things are on a 16:9 screenshot of a chest (SkyUI), as fractions of
// its width and height. The item names: below the headers, and short of the
// Type column, whose long words ("Nourriture", "Ingrédient") start at 0.317.
const NAMES = { left: 0.039, top: 0.165, width: 0.261, height: 0.662 };
// What a line shows to the gérant: its icon, name, count and Type.
const STRIP = { left: 0.02, width: 0.43 };

/** Part of a screenshot, enlarged, in black on white: what the OCR reads best. */
function forOcr(bitmap: ImageBitmap, area: typeof NAMES) {
  const sx = Math.round(bitmap.width * area.left);
  const sy = Math.round(bitmap.height * area.top);
  const sw = Math.round(bitmap.width * area.width);
  const sh = Math.round(bitmap.height * area.height);
  const canvas = document.createElement("canvas");
  // Thin letters, enlarged three times and kept thick by a low threshold: at
  // twice the size, "a" reads as "o" ("Chair de ssumon").
  canvas.width = sw * 3;
  canvas.height = sh * 3;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const light = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = light > 120 ? 0 : 255;
    px[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

/** What was read on one screenshot. */
export type Page = { file: File; ratio: number; lines: ReadLine[] };

/** Reads each screenshot in the browser, in their order. */
export async function readScreenshots(files: File[], onProgress: (done: number) => void): Promise<Page[]> {
  const { createWorker } = await import("tesseract.js");
  // Served by the app (scripts/copy-ocr-assets.mjs), never by a CDN.
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker("fra", 1, { workerPath: `${base}/worker.min.js`, corePath: base, langPath: base });
  try {
    // One block of uniform lines: the list of the chest.
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
    const pages: Page[] = [];
    for (const [page, file] of files.entries()) {
      const bitmap = await createImageBitmap(file);
      const { data } = await worker.recognize(forOcr(bitmap, NAMES), {}, { blocks: true });
      const height = bitmap.height;
      const ratio = bitmap.width / height;
      bitmap.close();
      // The boxes are in the enlarged names column: back to fractions of the screenshot.
      const at = (y: number) => NAMES.top + y / 3 / height;
      const lines: OcrLine[] = (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.map((line) => ({
            text: line.text,
            top: at(line.bbox.y0),
            bottom: at(line.bbox.y1),
            words: line.words.map((w) => ({ text: w.text, confidence: w.confidence })),
          })),
        ),
      );
      pages.push({ file, ratio, lines: parseOcrPage(lines, page) });
      onProgress(pages.length);
    }
    return pages;
  } finally {
    await worker.terminate();
  }
}

/**
 * What to check about the screenshots themselves: none read, not full
 * screen, or a page missing between two. The game sorts a list by name: a
 * screenshot that shares no line with the one before yet goes on in that
 * order is likely the same list, with a page skipped; one that starts over
 * is another tab.
 */
export function screenshotWarnings(pages: Page[], overlaps: number[]) {
  const warnings: string[] = [];
  pages.forEach((page, i) => {
    const name = page.file.name;
    if (Math.abs(page.ratio - 16 / 9) > 0.05) {
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
export function LineStrip({ file, line }: { file: File; line: ReadLine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    createImageBitmap(file).then((bitmap) => {
      const canvas = ref.current;
      if (!live || !canvas) return bitmap.close();
      const pad = 0.004 * bitmap.height;
      const sx = bitmap.width * STRIP.left;
      const sw = bitmap.width * STRIP.width;
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
  }, [file, line]);
  return <canvas ref={ref} className="count-strip" role="img" aria-label={`Sur ${file.name} : ${line.name}${line.count > 1 ? ` (${line.count})` : ""}`} />;
}

