"use client";

import { Fragment, useState } from "react";

export type Choice<T> = { id: T; name: string; group?: string };

type Common<T> = {
  id: string;
  choices: Choice<T>[];
  /** Accessible name of the list, e.g. "Marchandises". */
  listLabel: string;
  name?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
};

/** The field's value is one of the choices, sent by id in a hidden field. */
type Picked<T> = Common<T> & {
  free?: false;
  /** Stay at the end of the list whatever is typed (e.g. "Autre article"). */
  extras?: Choice<T>[];
  value: T | null;
  onChange: (id: T) => void;
  /** Shown when the typed text matches nothing. */
  emptyText: string;
};

/** The field's value is the text itself; the choices only suggest names. */
type Typed<T> = Common<T> & {
  free: true;
  value: string;
  onChange: (text: string) => void;
};

/**
 * A field you can type into, with a list below it that the text filters as
 * you type: a click, or the arrows then Enter, picks a choice. Choices that
 * carry a `group` are listed under its heading.
 *
 * Two kinds. By default the value must be one of the choices: Escape or
 * leaving the field keeps the one already chosen, and `required` refuses the
 * form while nothing is chosen. With `free`, any text is a value: the
 * choices are suggestions, nothing is highlighted until the arrows move, so
 * Enter on a new name submits the form like a plain field.
 */
export function Combobox<T extends number | string>(props: Picked<T> | Typed<T>) {
  const { id, choices, listLabel, name, required, placeholder, maxLength } = props;
  const extras = props.free ? [] : (props.extras ?? []);
  const all = [...choices, ...extras];
  const selected = props.free ? undefined : all.find((c) => c.id === props.value);
  const [pickedText, setPickedText] = useState(selected?.name ?? "");
  const text = props.free ? props.value : pickedText;
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  // -1: nothing highlighted (free fields start there).
  const [active, setActive] = useState(-1);
  const query = text.trim().toLocaleLowerCase("fr");
  const matches =
    editing && query ? choices.filter((c) => c.name.toLocaleLowerCase("fr").includes(query)) : choices;
  // A free field hides its list when nothing matches, or when the text is exactly a choice.
  const shown = props.free
    ? matches.filter((c) => c.name.toLocaleLowerCase("fr") !== query || matches.length > 1)
    : [...matches, ...extras];
  const listOpen = open && (!props.free || shown.length > 0);
  const listId = `${id}-list`;
  const optionId = (c: Choice<T>) => `${listId}-${c.id}`;

  function setText(value: string) {
    if (props.free) props.onChange(value);
    else setPickedText(value);
  }

  function choose(c: Choice<T>) {
    if (props.free) props.onChange(c.name);
    else {
      props.onChange(c.id);
      setPickedText(c.name);
    }
    setEditing(false);
    setOpen(false);
  }

  function close() {
    if (!props.free) setPickedText(selected?.name ?? "");
    setEditing(false);
    setOpen(false);
  }

  return (
    <div className="combobox">
      {name && !props.free && <input type="hidden" name={name} value={props.value ?? ""} />}
      <input
        id={id}
        name={props.free ? name : undefined}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && shown[active] ? optionId(shown[active]) : undefined}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        value={text}
        onFocus={(e) => {
          e.target.select();
          setActive(props.free ? -1 : Math.max(0, shown.findIndex((c) => c.id === props.value)));
          setOpen(true);
        }}
        onBlur={close}
        onChange={(e) => {
          setText(e.target.value);
          setEditing(true);
          setActive(props.free ? -1 : 0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!listOpen) return setOpen(true);
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => Math.min(Math.max(i + step, 0), Math.max(shown.length - 1, 0)));
          } else if (e.key === "Enter") {
            if (!listOpen) return;
            // A free field with nothing highlighted keeps its text, and Enter submits the form.
            if (props.free && !shown[active]) return setOpen(false);
            // While the list is open, Enter belongs to it and never submits the form.
            e.preventDefault();
            // A name that matches nothing does not fall through to the extras.
            if (shown[active] && (matches.length > 0 || !(editing && query))) choose(shown[active]);
          } else if (e.key === "Escape") {
            close();
          }
        }}
      />
      {listOpen && (
        <ul id={listId} role="listbox" className="combobox-list" aria-label={listLabel}>
          {!props.free && matches.length === 0 && <li className="muted">{props.emptyText}</li>}
          {shown.map((c, i) => (
            <Fragment key={c.id}>
              {c.group && c.group !== shown[i - 1]?.group && (
                <li role="presentation" className="combobox-group">
                  {c.group}
                </li>
              )}
              <li
                id={optionId(c)}
                role="option"
                aria-selected={i === active}
                // Keep the focus in the field, so its blur does not close the list before the click.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c)}
                onMouseEnter={() => setActive(i)}
              >
                {c.name}
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
