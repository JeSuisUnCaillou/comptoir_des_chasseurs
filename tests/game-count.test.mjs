// The chest parser on its own, without OCR: fixed lines in, exact counts out.
// The lines of armoire-8-captures.json are what Chromium's OCR read from
// Caillou's eight screenshots of Lomone's wardrobe (2026-11-16), in order.
// A reading bug becomes one more case here.
//
//   npm run test:parser
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inListOrder, leftWarning, MAX_COUNT_LINES, parseLine, parsePage, splitForCount, stitchPages, sumItems } from "../lib/game-count.ts";

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

test("les captures se remettent dans l'ordre de la liste, quel que soit l'ordre des fichiers", () => {
  const shuffled = [3, 7, 0, 5, 2, 6, 1, 4].map((i) => ARMOIRE[i]);
  assertCounts(inListOrder(shuffled, (page) => page));
  // Two neighbours swapped, as Caillou's files were (#231): without the list order, counted twice.
  const swapped = [0, 1, 3, 2, 4, 5, 6, 7].map((i) => ARMOIRE[i]);
  assert.equal(counts(swapped)["Mountain Lion Pelt"], "29 + 1 + 29");
  assertCounts(inListOrder(swapped, (page) => page));
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

test("une ligne que la capture d'avant a manquée est reprise de la suivante", () => {
  // The first screenshot missed Gauntlets; the second, further down, read it.
  const first = parsePage("Leather (703)\nMiel\nNorthern Hide Armor (3)\nNorthern Hide Boots (3)\nNorthern Hide Helmet (3)\nOeil de smilodon");
  const second = parsePage(
    "Northern Hide Armor (3)\nNorthern Hide Boots (3)\nNorthern Hide Gauntlets (3)\nNorthern Hide Helmet (3)\nOeil de smilodon\nPatte de lapin crue (232)",
  );
  const { lines } = stitchPages([first, second]);
  assert.deepEqual(
    lines.map((l) => l.name),
    ["Leather", "Miel", "Northern Hide Armor", "Northern Hide Boots", "Northern Hide Gauntlets", "Northern Hide Helmet", "Oeil de smilodon", "Patte de lapin crue"],
  );
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
