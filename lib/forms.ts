/** Reading the fields of a submitted form, the same way in every Server Action. */

import { memberRole, type MemberRole } from "@/lib/db/schema";

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

/** The most of one merchandise a line, a movement or an offer may count. */
export const MAX_QUANTITY = 1_000_000;

/** The one message for a quantity that is not a whole number from 1 to MAX_QUANTITY. */
export const QUANTITY_ERROR = "La quantité doit être un nombre entier entre 1 et 1 000 000.";

/** A quantity of merchandise: a whole number from 1 to MAX_QUANTITY. */
export function isQuantity(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= MAX_QUANTITY;
}

/** The longest name and client a contract keeps. */
export const CONTRACT_NAME_MAX = 100;
export const CONTRACT_CLIENT_MAX = 100;
/** The most merchandises a contract is written with at once. */
export const CONTRACT_LINES_MAX = 25;

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
  return productIdentity(formData.get("name"), formData.get("categoryId"), formData.get("unit"));
}

/**
 * `readProductIdentity` from the fields' raw values, for a form with several
 * merchandises (a purchase, one per line).
 */
export function productIdentity(rawName: unknown, rawCategory: unknown, rawUnit: unknown) {
  const name = String(rawName ?? "").trim().slice(0, 100);
  const category = String(rawCategory ?? "").trim();
  const categoryId = Number(category);
  const unit = String(rawUnit ?? "").trim().slice(0, 30) || "pièce";
  const error = !name
    ? "Le nom est obligatoire."
    : category === "" || !Number.isInteger(categoryId) || categoryId < 1
      ? "Choisis une catégorie."
      : undefined;
  return { name, categoryId: error ? 0 : categoryId, unit, error };
}

/** A quantity a price is given for: 1 when left empty. */
function perQty(formData: FormData, key: string) {
  const n = optionalInt(formData, key);
  return n == null ? 1 : n;
}

/**
 * Reads a merchandise's prices from a form, the same way for every form that
 * sets them. The leather batch only counts for hides, which the service
 * checks against the category. `error` says what is wrong, if anything.
 */
export function readProductPrices(formData: FormData) {
  const prices = {
    buyPrice: optionalInt(formData, "buyPrice"),
    buyQty: perQty(formData, "buyQty"),
    sellPrice: optionalInt(formData, "sellPrice"),
    sellQty: perQty(formData, "sellQty"),
    bulkMin: optionalInt(formData, "bulkMin"),
    bulkPrice: optionalInt(formData, "bulkPrice"),
    bulkQty: perQty(formData, "bulkQty"),
    hidesPerBatch: optionalInt(formData, "hidesPerBatch"),
    leatherPerBatch: optionalInt(formData, "leatherPerBatch"),
  };
  // One field per privileged group, named after the group's id: empty, the group gets the usual price.
  const privileged = [...formData.keys()]
    .filter((key) => PRIVILEGED_FIELD.test(key))
    .map((key) => ({ groupId: Number(key.slice(PRIVILEGED_PREFIX.length)), buyPrice: optionalInt(formData, key) }));
  const numbers = [...Object.values(prices), ...privileged.map((p) => p.buyPrice)].filter((v) => typeof v === "number");
  const error = numbers.some((n) => Number.isNaN(n))
    ? "Les prix et quantités doivent être des nombres entiers positifs."
    : [prices.buyQty, prices.sellQty, prices.bulkQty].some((n) => !isQuantity(n))
      ? QUANTITY_ERROR
      : (prices.hidesPerBatch == null) !== (prices.leatherPerBatch == null)
        ? "Remplis les peaux et les cuirs, ou laisse les deux vides."
        : undefined;
  return { prices, privileged, error };
}

/** The longest name a privileged group may have. */
export const GROUP_NAME_MAX = 60;

/** The name of a merchandise's price field for a privileged group: "privileged-3". */
export const PRIVILEGED_PREFIX = "privileged-";
const PRIVILEGED_FIELD = /^privileged-[1-9][0-9]{0,8}$/;
