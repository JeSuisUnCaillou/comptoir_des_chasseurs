// The chest parser on its own, without OCR: fixed lines in, exact counts out.
// The lines of armoire-8-captures.json are what Chromium's OCR read from
// Caillou's eight screenshots of Lomone's wardrobe (2026-11-16), in order.
// A reading bug becomes one more case here.
//
//   npm run test:parser
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  bigGap,
  countChecks,
  countedProducts,
  leftWarning,
  matchProduct,
  MAX_COUNT_LINES,
  NEW_PRODUCT,
  parseLine,
  parsePage,
  proposeProducts,
  readingWarnings,
  splitForCount,
  stitchPages,
  sumItems,
} from "../lib/game-count.ts";

const ARMOIRE = JSON.parse(readFileSync(new URL("armoire-8-captures.json", import.meta.url), "utf8")).map((lines) =>
  parsePage(lines.join("\n")),
);

/** Each item's lines, as the review shows them: "232 + 1". */
function counts(pages) {
  const { lines } = stitchPages(pages);
  return Object.fromEntries(sumItems(lines).map((item) => [item.name, item.lines.map((l) => l.count).join(" + ")]));
}

// The lines that came out twice before the screenshots were aligned (#220).
const EXPECTED = {
  "Patte de lapin crue": "232 + 1",
  "Pattes de vasard": "465 + 1",
  "Peau d'ours": "66 + 1 + 1",
  "Mountain Lion Pelt": "1 + 29",
};

function assertCounts(pages) {
  const read = counts(pages);
  for (const [name, expected] of Object.entries(EXPECTED)) assert.equal(read[name], expected, name);
}

test("les huit captures de l'armoire : chaque ligne vue sur deux captures ne compte qu'une fois", () => {
  assert.deepEqual(stitchPages(ARMOIRE).overlaps, [0, 2, 3, 2, 20, 5, 2, 5]);
  assertCounts(ARMOIRE);
});

test("une capture dont la première ligne est coupée se recolle quand même", () => {
  assertCounts(ARMOIRE.map((page, i) => (i === 0 ? page : page.slice(1))));
});

test("une ligne manquée ou lue autrement dans le chevauchement ne double pas le reste", () => {
  const { overlaps } = stitchPages(ARMOIRE);
  const pages = ARMOIRE.map((page, i) => {
    if (i === 0) return page;
    const changed = page.slice();
    // Missed by the OCR, where two common lines at least remain: one alone may be chance.
    if (overlaps[i] >= 3) changed.splice(1, 1);
    if (changed[2]) changed[2] = { ...changed[2], name: changed[2].name.replace(/[aeo]/, "o") }; // a letter read otherwise
    return changed;
  });
  assertCounts(pages);
});

test("deux captures sans lignes communes ne se recollent pas sur une ligne égale par hasard", () => {
  const first = parsePage("Cuir (12)\nPeau de loup (4)\nPeau de biche (3)");
  const second = parsePage("Peau de biche (3)\nPeau de vache (7)\nViande de cheval (2)");
  assert.deepEqual(stitchPages([first, second]).overlaps, [0, 0]);
});

test("l'icône « volé » et ce qui la suit ne font pas partie du nom", () => {
  assert.deepEqual(parseLine("Lys des cimes rouge # NS"), { name: "Lys des cimes rouge", count: 1 });
  assert.deepEqual(parseLine("Peau d'ours Ÿ (66)"), { name: "Peau d'ours", count: 66 });
  assert.deepEqual(parseLine("Arc à poulies (2)"), { name: "Arc à poulies", count: 2 });
  assert.deepEqual(parseLine("Arc long (Pristine) (3)"), { name: "Arc long (Pristine)", count: 3 });
});

test("deux objets qui ne diffèrent que d'un mot restent séparés", () => {
  const read = counts([parsePage("Lys des cimes jaune (4)\nLys des cimes rouge (2)")]);
  assert.equal(read["Lys des cimes jaune"], "4");
  assert.equal(read["Lys des cimes rouge"], "2");
});

test("au-delà de 300 objets, les derniers sont laissés pour un autre comptage, et le gérant le sait", () => {
  const items = Array.from({ length: MAX_COUNT_LINES + 2 }, (_, i) => ({ name: `Objet numero ${i}`, key: "", lines: [], total: 1 }));
  const { kept, left } = splitForCount(items);
  assert.equal(kept.length, MAX_COUNT_LINES);
  assert.deepEqual(left.map((item) => item.name), [`Objet numero ${MAX_COUNT_LINES}`, `Objet numero ${MAX_COUNT_LINES + 1}`]);
  assert.match(leftWarning(left), /les 2 derniers, de « Objet numero 300 » à « Objet numero 301 », ne sont pas comptés\. Fais l'import en plusieurs fois/);
  assert.equal(leftWarning(splitForCount(items.slice(0, 3)).left), null);
});

// From here, what the review does with the items read: the merchandise of each, and the checks before writing.

const SHOP = [
  { id: 1, name: "Loup", stock: 188 },
  { id: 2, name: "Biche", stock: 200 },
  { id: 3, name: "Cuir", stock: 10 },
  { id: 4, name: "Lapin", stock: 0 },
];

test("un objet est rattaché par un nom retenu, puis par son nom, puis par l'animal de sa peau", () => {
  const aliases = [{ name: "deer pelt", productId: 2 }];
  assert.equal(matchProduct("Deer Pelt", SHOP, aliases)?.name, "Biche");
  assert.equal(matchProduct("Wolf Peli", SHOP, [{ name: "wolf pelt", productId: 1 }])?.name, "Loup");
  assert.equal(matchProduct("Cuir", SHOP, [])?.name, "Cuir");
  assert.equal(matchProduct("Peau de loup", SHOP, [])?.name, "Loup");
  assert.equal(matchProduct("Viande de cheval", SHOP, []), undefined);
});

test("une supposition ne prend jamais une marchandise qu'un autre objet est déjà, ni un objet de moins de 6", () => {
  const items = sumItems(parsePage("Peau de loup (4)\nLoupe (9)\nLapins (2)\nBichette (8)"));
  const proposed = proposeProducts(items, SHOP, []);
  assert.equal(proposed[0].product?.name, "Loup");
  assert.equal(proposed[1].guess, undefined, "Loup est déjà pris par Peau de loup");
  assert.equal(proposed[2].product?.name, "Lapin");
  assert.equal(proposed[3].guess, undefined, "trop loin de Biche");
  const lapine = proposeProducts(sumItems(parsePage("Lapine (6)\nLapinx (5)")), SHOP.filter((p) => p.id !== 4).concat({ id: 5, name: "Lapin des neiges", stock: 0 }), []);
  assert.deepEqual(lapine.map((p) => p.product?.name ?? p.guess?.name), [undefined, undefined]);
  assert.equal(proposeProducts(sumItems(parsePage("Biches (7)")), SHOP.filter((p) => p.id !== 2).concat({ id: 6, name: "Bichet", stock: 0 }), [])[0].guess?.name, "Bichet");
});

test("un gros écart : plus de 100, ou au moins 10 et plus de la moitié du stock", () => {
  assert.equal(bigGap(500, 601), true);
  assert.equal(bigGap(500, 600), false);
  assert.equal(bigGap(18, 9), false, "9 d'écart");
  assert.equal(bigGap(18, 28), true, "10 d'écart, plus de la moitié de 18");
  assert.equal(bigGap(40, 50), false, "10 d'écart, pas plus de la moitié de 40");
  assert.equal(bigGap(0, 54), true);
});

const row = (n, name, productId, counted, more = {}) => ({ n, name, productId, counted: String(counted), guessed: false, doubtful: false, ...more });

test("les objets rattachés à une même marchandise s'additionnent, et son écart se juge sur le total", () => {
  const rows = [row(0, "Peau de loup", "1", 100), row(1, "Wolf Pelt", "1", 150), row(2, "Cuir", "3", 10), row(3, "Bidule", "", 4), row(4, "Neuf", NEW_PRODUCT, 3)];
  const counted = countedProducts(rows, SHOP);
  assert.deepEqual([...counted.keys()], ["1", "3"]);
  assert.equal(counted.get("1").total, 250);
  assert.equal(counted.get("1").big, false);
  assert.equal(counted.get("3").big, false);
});

test("avant d'inscrire : une supposition, un nombre douteux, un gros écart une seule fois par marchandise", () => {
  const rows = [
    row(0, "Peau de loup", "1", 400),
    row(1, "Wolf Pelt", "1", 10),
    row(2, "Bichette", "2", 200, { guessed: true }),
    row(3, "Cuir", "3", 10, { doubtful: true }),
    row(4, "Bidule", "", 4, { doubtful: true }),
    row(5, "Neuf", NEW_PRODUCT, 3, { doubtful: true }),
  ];
  assert.deepEqual(countChecks(rows, SHOP), [
    { n: 0, kind: "gap", product: "Loup", stock: 188, counted: 410 },
    { n: 2, kind: "guessed", item: "Bichette", product: "Biche" },
    { n: 3, kind: "doubtful", item: "Cuir" },
    { n: 5, kind: "doubtful", item: "Neuf" },
  ]);
  assert.deepEqual(countChecks([row(0, "Cuir", "3", 10)], SHOP), []);
});

test("à propos des captures : pas en plein écran, aucun objet lu, une page manquante, des objets en trop", () => {
  const page = (name, text, fullScreen = true) => ({ name, fullScreen, lines: parsePage(text) });
  const pages = [page("1.jpg", "Cuir (12)\nPeau de biche (3)"), page("2.jpg", "Peau de loup (4)\nPeau de renard (2)", false), page("3.jpg", ""), page("4.jpg", "Ail (3)")];
  const { overlaps } = stitchPages(pages.map((p) => p.lines));
  const left = [{ name: "Zèbre", key: "zebre", lines: [], total: 1 }];
  assert.match(leftWarning(left), /le dernier, « Zèbre », n'est pas compté\./);
  assert.deepEqual(readingWarnings(pages, overlaps, left), [
    "2.jpg n'est pas une capture plein écran en 16:9 : ses lignes peuvent être mal lues.",
    "1.jpg et 2.jpg n'ont aucune ligne en commun : une page manque peut-être entre les deux.",
    "3.jpg : aucun objet lu. Est-ce bien la liste d'un coffre, en plein écran ?",
    leftWarning(left),
  ]);
});
