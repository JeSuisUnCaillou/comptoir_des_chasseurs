"use client";

// Reading screenshots of a chest in the browser, in three parts: the layout
// of the game's screen (where its lines are), the OCR engine (tesseract.js,
// which gives OcrLine), and the loop over the screenshots; then a line cut
// from one. What is read is parsed, and checked, by lib/game-count.ts, which
// knows nothing of the OCR engine.

import { useEffect, useRef } from "react";
import { parseOcrPage, type OcrLine, type ReadLine, type ReadPage } from "@/lib/game-count";

/**
 * A screen of the game the app reads, and how: where its lines are on a
 * screenshot, how to make them readable, in which language. Fractions are of
 * the screenshot's width and height. The OCR and the loop take a layout:
 * the chest's is the only one so far (#225).
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
const CHEST: ScreenLayout = {
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
  try {
    // One block of uniform lines: the list.
    await worker.setParameters({ tessedit_pageseg_mode: "6" as never });
    return worker;
  } catch (error) {
    await worker.terminate();
    throw error;
  }
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
export type Page = ReadPage & { file: File };

/** Reads each screenshot of a chest in the browser, in their order. */
export async function readScreenshots(files: File[], onProgress: (done: number) => void): Promise<Page[]> {
  const layout = CHEST;
  const ocr = await startOcr(layout);
  try {
    const pages: Page[] = [];
    for (const [page, file] of files.entries()) {
      const bitmap = await createImageBitmap(file);
      try {
        const lines = await recognize(ocr, bitmap, layout);
        const fullScreen = Math.abs(bitmap.width / bitmap.height - layout.ratio) <= layout.ratioTolerance;
        pages.push({ file, name: file.name, fullScreen, lines: parseOcrPage(lines, page) });
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

/** A line of a screenshot as the game shows it, drawn from the screenshot itself. */
export function LineStrip({ file, line }: { file: File; line: ReadLine }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    createImageBitmap(file).then((bitmap) => {
      const canvas = ref.current;
      if (!live || !canvas) return bitmap.close();
      const pad = 0.004 * bitmap.height;
      const sx = bitmap.width * CHEST.strip.left;
      const sw = bitmap.width * CHEST.strip.width;
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

