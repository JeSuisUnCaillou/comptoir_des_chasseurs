"use client";

import { useState } from "react";

type Choice = { id: number; name: string };

/**
 * A product picker you can type into: the text filters the list as you type,
 * a click or Enter picks a product, Escape or leaving the field keeps the
 * product already chosen.
 */
export function ProductCombobox({
  id,
  products,
  value,
  onChange,
}: {
  id: string;
  products: Choice[];
  value: number;
  onChange: (id: number) => void;
}) {
  const selected = products.find((p) => p.id === value);
  const [text, setText] = useState(selected?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = text.trim().toLocaleLowerCase("fr");
  const options =
    editing && query ? products.filter((p) => p.name.toLocaleLowerCase("fr").includes(query)) : products;
  const listId = `${id}-list`;

  function choose(p: Choice) {
    onChange(p.id);
    setText(p.name);
    setEditing(false);
    setOpen(false);
  }

  function reset() {
    setText(selected?.name ?? "");
    setEditing(false);
    setOpen(false);
  }

  return (
    <div className="combobox">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${options[active].id}` : undefined}
        autoComplete="off"
        value={text}
        onFocus={(e) => {
          e.target.select();
          setActive(Math.max(0, products.findIndex((p) => p.id === value)));
          setOpen(true);
        }}
        onBlur={reset}
        onChange={(e) => {
          setText(e.target.value);
          setEditing(true);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return setOpen(true);
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => Math.min(Math.max(i + step, 0), Math.max(options.length - 1, 0)));
          } else if (e.key === "Enter") {
            if (open && options[active]) {
              e.preventDefault();
              choose(options[active]);
            }
          } else if (e.key === "Escape") {
            reset();
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="combobox-list" aria-label="Marchandises">
          {options.length === 0 && <li className="muted">Aucune marchandise ne correspond.</li>}
          {options.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${p.id}`}
              role="option"
              aria-selected={i === active}
              // Keep the focus in the field, so its blur does not close the list before the click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
            >
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
