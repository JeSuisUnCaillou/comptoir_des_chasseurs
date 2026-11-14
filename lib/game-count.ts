// Counting a chest of the game from screenshots of its inventory: reading the
// lines the OCR found, stitching overlapping screenshots, summing each item,
// and finding the merchandise it is. Pure: no database, no React.

/** One line of the chest as the game shows it: "Peau de loup (186)". */
export type ReadLine = { name: string; count: number };

/** One item of the chest, its lines summed: "Deer Pelt", 1 + 13. */
export type ReadItem = { name: string; key: string; counts: number[]; total: number };

/** Most lines a count may hold, read or sent. */
export const MAX_COUNT_LINES = 300;

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
 * One line of OCR text, or null when it is not an item. The count is in
 * brackets after the name, "(13)"; without one, the line is a single item.
 * What the stolen-hand icon reads as ("#", "4", "Ÿ") is dropped.
 */
export function parseLine(raw: string): ReadLine | null {
  const line = raw.replace(/\s+/g, " ").trim();
  const counted = line.match(/^(.*?)\s*[({\[]\s*(\d[\d\s]*)\s*[)}\]]/);
  let name: string;
  let count = 1;
  if (counted) {
    name = counted[1];
    count = Number(counted[2].replace(/\s/g, ""));
  } else {
    // Trailing tokens of one character or no letter are the icon, not the name.
    const words = line.split(" ");
    while (words.length > 1 && (words.at(-1)!.length === 1 || !/\p{L}{2}/u.test(words.at(-1)!))) words.pop();
    name = words.join(" ");
  }
  name = name.replace(/^[^\p{L}]+/u, "").trim();
  if ((name.match(/\p{L}/gu) ?? []).length < 3 || !Number.isInteger(count) || count <= 0) return null;
  return { name, count };
}

/** The item lines of one screenshot's OCR text. */
export function parsePage(text: string) {
  return text.split("\n").flatMap((raw) => parseLine(raw) ?? []);
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

function similar(a: string, b: string) {
  return a === b || (Math.min(a.length, b.length) >= 8 && distance(a, b) <= 1);
}

function sameLine(a: ReadLine, b: ReadLine) {
  return a.count === b.count && similar(normalizeName(a.name), normalizeName(b.name));
}

/**
 * The lines of screenshots taken while scrolling down a chest, in order. The
 * bottom lines of one screenshot that are the top lines of the next are the
 * same lines seen twice: they count once. The longest such overlap wins.
 */
export function stitchPages(pages: ReadLine[][]) {
  const lines: ReadLine[] = [];
  for (const page of pages) {
    let overlap = 0;
    for (let k = Math.min(lines.length, page.length); k > 0; k--) {
      const tail = lines.slice(lines.length - k);
      if (tail.every((line, i) => sameLine(line, page[i]))) {
        overlap = k;
        break;
      }
    }
    lines.push(...page.slice(overlap));
  }
  return lines;
}

/** The lines of one item summed, stolen or not, in the order they first appear. */
export function sumItems(lines: ReadLine[]): ReadItem[] {
  const items: ReadItem[] = [];
  for (const line of lines) {
    const key = normalizeName(line.name);
    const item = items.find((i) => similar(i.key, key));
    if (item) {
      item.counts.push(line.count);
      item.total += line.count;
    } else {
      items.push({ name: line.name, key, counts: [line.count], total: line.count });
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
  const alias = aliases.find((a) => a.name === key);
  const aliased = alias && products.find((p) => p.id === alias.productId);
  if (aliased) return aliased;
  const named = products.map((p) => ({ p, key: normalizeName(p.name) }));
  return (
    named.find((n) => n.key === key)?.p ??
    named.find((n) => n.key === withoutHide(key))?.p ??
    named.find((n) => similar(n.key, withoutHide(key)))?.p
  );
}

/** The count of each merchandise: the items tied to the same one add up. */
export function sumByProduct<K>(lines: { productId: K; counted: number }[]) {
  const totals = new Map<K, number>();
  for (const { productId, counted } of lines) totals.set(productId, (totals.get(productId) ?? 0) + counted);
  return totals;
}
