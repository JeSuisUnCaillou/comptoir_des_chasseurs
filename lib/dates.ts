/** Calendar days in Keizaal's time zone (Europe/Paris), for filters and counts of days. */

const parisHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  hour: "2-digit",
  hourCycle: "h23",
});
const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });

/** Midnight in Keizaal's time zone (Europe/Paris) for a "YYYY-MM-DD" date. */
export function parisDay(value: string | undefined, offsetDays = 0): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const utc = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(utc.getTime())) return undefined;
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  // Paris is UTC+1 or UTC+2: find which by formatting that instant there.
  return new Date(utc.getTime() - Number(parisHour.format(utc)) * 3600_000);
}

/**
 * The "du" and "au" dates of a filter, from the query string ("YYYY-MM-DD",
 * anything else ignored), and the instants they stand for in Paris: from
 * midnight on "du" to midnight after "au", which is included. A reversed
 * range is put back in order.
 */
export function dayRange(duParam: string | undefined, auParam: string | undefined) {
  let du = duParam && parisDay(duParam) ? duParam : undefined;
  let au = auParam && parisDay(auParam) ? auParam : undefined;
  if (du && au && du > au) [du, au] = [au, du];
  return { du, au, from: parisDay(du), to: parisDay(au, 1) };
}

/**
 * Like `dayRange`, but a period of `days` days ending today when nothing is
 * asked: a lone "au" gets the `days` days ending on it, a lone "du" runs to today.
 */
export function lastDays(duParam: string | undefined, auParam: string | undefined, days: number, now = new Date()) {
  const asked = dayRange(duParam, auParam);
  const au = asked.au ?? parisToday(now);
  const du = asked.du ?? parisToday(parisDay(au, 1 - days)!);
  return { ...dayRange(du, au), asked };
}

/** Days from one "YYYY-MM-DD" date to another. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Today's date in Paris, as "YYYY-MM-DD". */
export function parisToday(now = new Date()) {
  return parisDate.format(now);
}
