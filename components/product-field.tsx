"use client";

import { useState } from "react";
import { ProductCombobox } from "@/components/product-combobox";

/**
 * The product field of a plain form: the usual picker you can type into, which
 * keeps its choice itself and sends the chosen id as `name`. For a form whose
 * fields are not driven by its own state (a supplier's offer, a featured product).
 */
export function ProductField<T extends number | string>({
  id,
  name,
  products,
  required,
  placeholder = "Choisir ou taper un nom…",
}: {
  id: string;
  name: string;
  products: { id: T; name: string }[];
  required?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState<T | null>(null);
  return (
    <ProductCombobox
      id={id}
      name={name}
      required={required}
      placeholder={placeholder}
      products={products}
      value={value}
      onChange={setValue}
    />
  );
}
