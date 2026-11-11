/**
 * Where each row of a list sits in its entry, the lines a member wrote
 * together (see `entryKeyColumn`), so a table can show them as one block.
 * Rows of one entry are next to each other: lists are ordered by instant.
 */
export type EntryPosition = {
  /** The row belongs to an entry of several lines shown here. */
  grouped: boolean;
  /** First row of its entry here: it shows what the lines share. */
  first: boolean;
  last: boolean;
  /** The row that carries the entry's « Septims déposés / pris » button. */
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
        grouped: end - start > 1,
        first: i === start,
        last: i === end - 1,
        settles: i - start === settler,
      });
    }
    start = end;
  }
  return positions;
}

/** Row classes for a row's place in its entry. */
export function entryClasses(p: EntryPosition) {
  if (!p.grouped) return [];
  return ["entry", p.first ? "entry-first" : "entry-next", ...(p.last ? ["entry-last"] : [])];
}
