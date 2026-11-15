// A parser of the game's chests: from the OCR of screenshots of a chest's
// inventory (SkyUI), the items it holds and how many of each. It reads the
// lines, stitches overlapping screenshots, sums each item, and finds the
// merchandise it is. Pure: no database, no React, no OCR engine.

/** One line of the chest as the game shows it: "Peau de loup (186)". */
export type ReadLine = {
  name: string;
  count: number;
  /** The OCR was not sure of the count: the gérant checks it. */
  doubtful?: boolean;
  /** Where the line is: its screenshot, and its top and bottom as fractions of the screenshot's height. */
  page?: number;
  top?: number;
  bottom?: number;
};

/** One item of the chest, its lines summed: "Deer Pelt", 1 + 13. */
export type ReadItem = { name: string; key: string; lines: ReadLine[]; total: number };

/** A line as the OCR engine gives it, with its words and how sure it is of each (0 to 100). */
export type OcrLine = { text: string; top: number; bottom: number; words: { text: string; confidence: number }[] };

/** Most lines a count may hold, read or sent. */
export const MAX_COUNT_LINES = 300;

/** Below this confidence, a count read by the OCR is doubtful. */
const SURE = 70;

/**
 * A name made comparable: lower case, no accents, single spaces, straight
 * apostrophes, and each word without its plural "s" or "x".
 */
export function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, "") : word))
    .join(" ");
}

/** The animal of a hide, as the price grid names it: "peau de loup" → "loup", "deer pelt" → "deer". */
function withoutHide(normalized: string) {
  return normalized.replace(/^peau (de |d'|du |des )?/, "").replace(/ (pelt|hide|skin)$/, "");
}

/**
 * A normalized name with the letters the OCR mixes up made one: "o" for "a"
 * ("Peou de biche"), "l" for "i" and "t" ("Wolf Peli").
 */
function fold(normalized: string) {
  return normalized.replace(/o/g, "a").replace(/[it1]/g, "l");
}

/**
 * The name and count of one line of OCR text, or null when it is not an
 * item. The count is in brackets after the name, "(13)"; without one, the
 * line is a single item. The stolen-hand icon, read as "#", "4", "Ÿ" or "V",
 * ends the name: what follows it is the edge of the Type column.
 */
export function parseLine(raw: string): ReadLine | null {
  // "_" and "|" are the edge of a letter or of the icon, never part of a name.
  const line = raw.replace(/[_|]/g, " ").replace(/\s+/g, " ").trim();
  const counted = line.match(/^(.*?)\s*[({\[]\s*(\d[\d\s]*)\s*[)}\]]/);
  const count = counted ? Number(counted[2].replace(/\s/g, "")) : 1;
  const words = (counted ? counted[1] : line).split(" ");
  // The first word is the name's; from the second, a word without a letter, or of one
  // character but a lone "à" inside the name ("Arc à poulies"), is the icon.
  const icon = words.findIndex(
    (word, i) => i > 0 && (/^[^\p{L}]+$/u.test(word) || (word.length === 1 && (word !== "à" || i === words.length - 1))),
  );
  const kept = icon > 0 ? words.slice(0, icon) : words;
  // Two capitals after a word in lower case are the Type column's edge too ("Lys des cimes rouge XX").
  if (kept.length > 1 && /^\p{Lu}{1,2}$/u.test(kept.at(-1)!) && /\p{Ll}/u.test(kept.at(-2)!)) kept.pop();
  const name = kept.join(" ").replace(/^[^\p{L}]+/u, "").trim();
  if ((name.match(/\p{L}/gu) ?? []).length < 3 || !Number.isInteger(count) || count <= 0) return null;
  return { name, count };
}

/** The item lines of one screenshot, as text: one per line. */
export function parsePage(text: string) {
  return text.split("\n").flatMap((raw) => parseLine(raw) ?? []);
}

/** The item lines of one screenshot, with where each is and whether its count is sure. */
export function parseOcrPage(lines: OcrLine[], page: number): ReadLine[] {
  return lines.flatMap(({ text, top, bottom, words }) => {
    const line = parseLine(text);
    if (!line) return [];
    const countWord = words.find((w) => /[({\[]\s*\d/.test(w.text));
    return [{ ...line, doubtful: countWord ? countWord.confidence < SURE : undefined, page, top, bottom }];
  });
}

/** Edit distance, to forgive a letter the OCR read wrong ("Peli" for "Pelt"). */
function distance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/** Two normalized names the OCR may have read from the same one: a letter apart, once its usual mix-ups are set aside. */
function similar(a: string, b: string) {
  if (a === b) return true;
  const [fa, fb] = [fold(a), fold(b)];
  if (fa === fb) return true;
  // Two letters would make "Lys des cimes jaune" of "Lys des cimes rouge".
  return Math.min(a.length, b.length) >= 8 && distance(fa, fb) <= 1;
}

function sameLine(a: ReadLine, b: ReadLine) {
  return a.count === b.count && similar(normalizeName(a.name), normalizeName(b.name));
}

/**
 * The lines of screenshots of a chest, in order, each line once. A
 * screenshot that starts with lines already read (the bottom of the
 * previous one, or further up when the list was scrolled back) adds only
 * what follows them. The longest such overlap wins; a line in four may be
 * read differently on the two screenshots. `overlaps[i]`: how many lines of
 * screenshot i were already read, 0 when it shares none with what came before.
 */
export function stitchPages(pages: ReadLine[][]) {
  const lines: ReadLine[] = [];
  const overlaps: number[] = [];
  for (const page of pages) {
    let overlap = 0;
    for (let start = 0; start < lines.length && overlap === 0; start++) {
      const k = Math.min(lines.length - start, page.length);
      let wrong = 0;
      for (let i = 0; i < k; i++) if (!sameLine(lines[start + i], page[i])) wrong++;
      // Two lines at least, and the first one right: a single equal line may be chance.
      if ((k >= 2 || k === page.length) && sameLine(lines[start], page[0]) && wrong <= Math.floor(k / 4)) overlap = k;
    }
    overlaps.push(overlap);
    lines.push(...page.slice(overlap));
  }
  return { lines, overlaps };
}

/** The lines of one item summed, stolen or not, in the order they first appear. */
export function sumItems(lines: ReadLine[]): ReadItem[] {
  const items: ReadItem[] = [];
  for (const line of lines) {
    const key = normalizeName(line.name);
    const item = items.find((i) => similar(i.key, key));
    if (item) {
      item.lines.push(line);
      item.total += line.count;
    } else {
      items.push({ name: line.name, key, lines: [line], total: line.count });
    }
  }
  return items;
}

/**
 * The merchandise an item of the chest is: a name the shop tied to it before,
 * then its own name, then the animal of a hide ("Peau de loup" is "Loup").
 * Undefined when nothing fits: the gérant picks it.
 */
export function matchProduct<P extends { id: number; name: string }>(
  itemName: string,
  products: P[],
  aliases: { name: string; productId: number }[],
): P | undefined {
  const key = normalizeName(itemName);
  // The OCR may read a retained name with a letter wrong ("Wolf Peli").
  const alias = aliases.find((a) => a.name === key) ?? aliases.find((a) => similar(a.name, key));
  const aliased = alias && products.find((p) => p.id === alias.productId);
  if (aliased) return aliased;
  const named = products.map((p) => ({ p, key: normalizeName(p.name) }));
  return (
    named.find((n) => n.key === key)?.p ??
    named.find((n) => n.key === withoutHide(key))?.p ??
    named.find((n) => similar(n.key, key) || similar(n.key, withoutHide(key)))?.p
  );
}

/** Below this many, an item nothing recognized is not worth a guess. */
export const GUESS_FROM = 6;

/**
 * For an item nothing recognized, the merchandise whose name is closest,
 * when it is close enough to be a guess: about a letter in six apart, so
 * that "des vallées" is never "des neiges". The gérant confirms it.
 */
export function guessProduct<P extends { id: number; name: string }>(itemName: string, products: P[]): P | undefined {
  const key = fold(normalizeName(itemName));
  let best: { p: P; gap: number } | undefined;
  for (const p of products) {
    const name = fold(normalizeName(p.name));
    const gap = Math.min(distance(key, name), distance(fold(withoutHide(normalizeName(itemName))), name));
    if (gap <= Math.max(1, Math.floor(name.length / 6)) && (!best || gap < best.gap)) best = { p, gap };
  }
  return best?.p;
}

/** A gap between the stock and the count big enough to be checked: over 100, or over half the stock. */
export function bigGap(stock: number, counted: number) {
  const gap = Math.abs(counted - stock);
  return gap > 100 || (gap >= 10 && gap > stock / 2);
}

/** The count of each merchandise: the items tied to the same one add up. */
export function sumByProduct<K>(lines: { productId: K; counted: number }[]) {
  const totals = new Map<K, number>();
  for (const { productId, counted } of lines) totals.set(productId, (totals.get(productId) ?? 0) + counted);
  return totals;
}

/** The choice, in place of a merchandise, of creating one for the item. */
export const NEW_PRODUCT = "new";
