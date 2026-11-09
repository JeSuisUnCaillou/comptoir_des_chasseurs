export const PAGE_SIZE = 25;

type Param = string | string[] | undefined;

/** First value of a query parameter (Next gives an array when it is repeated). */
export function param(value: Param) {
  return Array.isArray(value) ? value[0] : value;
}

/** Page number from the query string, starting at 1. */
export function pageParam(value: Param) {
  const n = Number(param(value));
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function pageCount(total: number, size = PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / size));
}

export function offsetOf(page: number, size = PAGE_SIZE) {
  return (page - 1) * size;
}
