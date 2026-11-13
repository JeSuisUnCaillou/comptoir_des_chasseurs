"use client";

import { Combobox, type Choice } from "@/components/combobox";

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
