// Copies what the browser needs to read game screenshots (tesseract.js: its
// worker, its WebAssembly core and the French language data) into
// public/ocr/, so the app serves them itself: no CDN, nothing to pay.
// Run before every build and `next dev`; public/ocr/ is not committed.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const target = "public/ocr";
mkdirSync(target, { recursive: true });

const packageDir = (name) => dirname(require.resolve(`${name}/package.json`));
const files = [
  [join(packageDir("tesseract.js"), "dist", "worker.min.js"), "worker.min.js"],
  // The worker picks the fastest core the browser runs.
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map((v) => [
    join(packageDir("tesseract.js-core"), `tesseract-core-${v}.wasm.js`),
    `tesseract-core-${v}.wasm.js`,
  ]),
  [join(packageDir("@tesseract.js-data/fra"), "4.0.0_best_int", "fra.traineddata.gz"), "fra.traineddata.gz"],
];
for (const [from, name] of files) copyFileSync(from, join(target, name));
console.log(`OCR : ${files.length} fichiers copiés dans ${target}/.`);
