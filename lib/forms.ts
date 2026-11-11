/** Reading the fields of a submitted form, the same way in every Server Action. */

import { memberRole, productCategory, type MemberRole, type ProductCategory } from "@/lib/db/schema";

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

/** A member's role in a shop; null when it is not one. */
export function readRole(formData: FormData): MemberRole | null {
  const role = String(formData.get("role")) as MemberRole;
  return memberRole.enumValues.includes(role) ? role : null;
}

/**
 * Reads a merchandise's name, category and unit from a form, the same way for
 * every form that creates one. `error` says what is wrong, if anything.
 */
export function readProductIdentity(formData: FormData) {
  const name = text(formData, "name", 100);
  const category = String(formData.get("category")) as ProductCategory;
  const unit = text(formData, "unit", 30) || "pièce";
  const error = !name
    ? "Le nom est obligatoire."
    : !productCategory.enumValues.includes(category)
      ? "Catégorie inconnue."
      : undefined;
  return { name, category, unit, error };
}
