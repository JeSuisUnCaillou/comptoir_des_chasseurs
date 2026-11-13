/**
 * Where each row of a list sits in its entry, the lines a member wrote
 * together (see `entryKeyColumn`), so a table can show them as one block.
 * Rows of one entry are next to each other: lists are ordered by instant.
 */
export type EntryPosition = {
  /** First row of its entry here: it shows what the lines share. */
  first: boolean;
  last: boolean;
  /** The row that carries the entry's settle button (`SettleButton`). */
  settles: boolean;
};

export function entryPositions<T extends { entryKey: string | null }>(
  rows: T[],
  waiting: (row: T) => boolean,
): EntryPosition[] {
  const positions: EntryPosition[] = [];
  let start = 0;
  while (start < rows.length) {
    const key = rows[start].entryKey;
    let end = start + 1;
    while (key != null && end < rows.length && rows[end].entryKey === key) end++;
    const settler = rows.slice(start, end).findIndex(waiting);
    for (let i = start; i < end; i++) {
      positions.push({
        first: i === start,
        last: i === end - 1,
        settles: i - start === settler,
      });
    }
    start = end;
  }
  return positions;
}

/** Row classes for a row's place in its entry; a row alone is a block of one. */
export function entryClasses(p: EntryPosition) {
  return ["entry", p.first ? "entry-first" : "entry-next", ...(p.last ? ["entry-last"] : [])];
}

/**
 * Where an entry of several lines shows its total: on its second row as a table,
 * under what the lines share; on its last row as a card, at the bottom.
 */
export type EntryTotal = { total: number; table: boolean; card: boolean };

/**
 * The total of each entry of several lines, for each of its rows that shows it.
 * `amount` is what a row counts for, null when it counts for nothing (cancelled,
 * no money); an entry where no row counts has no total.
 */
export function entryTotals<T>(
  rows: T[],
  positions: EntryPosition[],
  amount: (row: T) => number | null,
): (EntryTotal | null)[] {
  const totals: (EntryTotal | null)[] = rows.map(() => null);
  let start = 0;
  while (start < rows.length) {
    let end = start;
    while (!positions[end].last) end++;
    const counted = rows.slice(start, end + 1).map(amount).filter((a): a is number => a != null);
    if (end > start && counted.length > 0) {
      const total = counted.reduce((a, b) => a + b, 0);
      for (let i = start + 1; i <= end; i++) {
        if (i === start + 1 || i === end) totals[i] = { total, table: i === start + 1, card: i === end };
      }
    }
    start = end + 1;
  }
  return totals;
}
