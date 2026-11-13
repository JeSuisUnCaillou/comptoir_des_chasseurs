"use client";

import { Fragment, useState } from "react";

type Choice<T> = { id: T; name: string; group?: string };

/**
 * The shop's merchandises as choices grouped by category, in the categories'
 * order; names keep their order inside each group.
 */
export function choicesByCategory(
  products: { id: number; name: string; categoryId: number; categoryName: string; categoryPosition: number }[],
) {
  return [...products]
    .sort((a, b) => a.categoryPosition - b.categoryPosition || a.categoryId - b.categoryId)
    .map((p) => ({ id: String(p.id), name: p.name, group: p.categoryName }));
}

/**
 * A product picker you can type into: the text filters the list as you type,
 * a click or Enter picks a product, Escape or leaving the field keeps the
 * product already chosen.
 *
 * Inside a form, `name` sends the chosen id in a hidden field and `required`
 * refuses the form while nothing is chosen. Choices that carry a `group` are
 * listed under its heading; `extras` stay at the end of the list whatever is
 * typed (e.g. "Autre article").
 */
export function ProductCombobox<T extends number | string>({
  id,
  products,
  extras = [],
  value,
  onChange,
  name,
  required,
  placeholder,
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
  const all = [...products, ...extras];
  const selected = all.find((p) => p.id === value);
  const [text, setText] = useState(selected?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = text.trim().toLocaleLowerCase("fr");
  const matches = editing && query ? products.filter((p) => p.name.toLocaleLowerCase("fr").includes(query)) : products;
  const options = [...matches, ...extras];
  const listId = `${id}-list`;
  const optionId = (p: Choice<T>) => `${listId}-${p.id}`;

  function choose(p: Choice<T>) {
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
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? optionId(options[active]) : undefined}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => {
          e.target.select();
          setActive(Math.max(0, options.findIndex((p) => p.id === value)));
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
            // While the list is open, Enter belongs to it and never submits the form.
            if (!open) return;
            e.preventDefault();
            // A name that matches nothing does not fall through to the extras.
            if (options[active] && (matches.length > 0 || !(editing && query))) choose(options[active]);
          } else if (e.key === "Escape") {
            reset();
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="combobox-list" aria-label="Marchandises">
          {matches.length === 0 && <li className="muted">Aucune marchandise ne correspond.</li>}
          {options.map((p, i) => (
            <Fragment key={p.id}>
              {p.group && p.group !== options[i - 1]?.group && (
                <li role="presentation" className="combobox-group">
                  {p.group}
                </li>
              )}
              <li
                id={optionId(p)}
                role="option"
                aria-selected={i === active}
                // Keep the focus in the field, so its blur does not close the list before the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
                onMouseEnter={() => setActive(i)}
              >
                {p.name}
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
