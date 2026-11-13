"use client";

import { Combobox, type Choice } from "@/components/combobox";

/**
 * The shop's merchandises as choices grouped by category, in the categories'
 * order (their ids); names keep their order inside each group.
 */
export function choicesByCategory(products: { id: number; name: string; categoryId: number; categoryName: string }[]) {
  return [...products]
    .sort((a, b) => a.categoryId - b.categoryId)
    .map((p) => ({ id: String(p.id), name: p.name, group: p.categoryName }));
}

/**
 * A product picker you can type into (see Combobox): a click or Enter picks a
 * product, Escape or leaving the field keeps the product already chosen.
 * `extras` stay at the end of the list whatever is typed (e.g. "Autre article").
 */
export function ProductCombobox<T extends number | string>({
  products,
  ...props
}: {
  id: string;
  products: Choice<T>[];
  extras?: Choice<T>[];
  value: T | null;
  onChange: (id: T) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <Combobox {...props} choices={products} listLabel="Marchandises" emptyText="Aucune marchandise ne correspond." />
  );
}
