"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

/** What a cell sorts by: a name, a number, or null for an empty cell, kept last. */
export type SortValue = string | number | null;

export type SortColumn = {
  label: string;
  /** Right-aligned, like the numbers below it. */
  num?: boolean;
  /** A header without a sort, named for screen readers only (the pencil's column). */
  ariaLabel?: string;
};

export type SortRow = {
  key: string | number;
  /** One per sortable column, in the columns' order. */
  values: SortValue[];
  /** The row's cells, as the server drew them. */
  cells: ReactNode;
};

type Sort = { column: number; dir: "asc" | "desc" };

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

function compare(a: SortValue, b: SortValue) {
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
  return (a as number) - (b as number);
}

/** The rows in the asked order, empty cells last both ways, ties in the server's order. */
function sorted(rows: SortRow[], sort: Sort | null) {
  if (!sort) return rows;
  const sign = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      const a = x.row.values[sort.column];
      const b = y.row.values[sort.column];
      if (a == null || b == null) return a == null && b == null ? x.index - y.index : a == null ? 1 : -1;
      return sign * compare(a, b) || x.index - y.index;
    })
    .map(({ row }) => row);
}

/**
 * A price list sorted by clicking its headers: a first click sorts up, the next
 * one down. In cards (a narrow box), the headers stay above as a row of buttons.
 */
export function SortableTable({
  columns,
  rows,
  ariaLabel,
}: {
  columns: SortColumn[];
  rows: SortRow[];
  ariaLabel?: string;
}) {
  const [sort, setSort] = useState<Sort | null>(null);

  function toggle(column: number) {
    setSort((s) => ({ column, dir: s?.column === column && s.dir === "asc" ? "desc" : "asc" }));
  }

  return (
    <div className="table-wrap">
      <table className="stack-cards sortable-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((c, i) => {
              if (c.ariaLabel) return <th key={i} aria-label={c.ariaLabel} />;
              const dir = sort?.column === i ? sort.dir : null;
              const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
              return (
                <th
                  key={i}
                  className={c.num ? "num" : undefined}
                  aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                >
                  <button type="button" className={dir ? "sort-btn sorted" : "sort-btn"} onClick={() => toggle(i)}>
                    {c.label}
                    <Icon size={12} aria-hidden />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted(rows, sort).map((row) => (
            <tr key={row.key}>{row.cells}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
