/** Reading the fields of a submitted form, the same way in every Server Action. */

/** A text field, trimmed and cut to `max` characters; "" when missing. */
export function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

/** Like `text`, but null when empty. */
export function optionalText(formData: FormData, key: string, max: number) {
  return text(formData, key, max) || null;
}

/** A whole number 0 or more; null when empty, NaN when it is something else. */
export function optionalInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

/** The id of a row: a whole number 1 or more; null when empty, NaN when it is something else. */
export function optionalId(formData: FormData, key = "id") {
  const n = optionalInt(formData, key);
  return n === 0 ? NaN : n;
}

/** A checkbox: true when ticked. */
export function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}
