/**
 * Date arithmetic in a named time zone.
 *
 * A calendar rendered on the server has no browser to ask what "today" is, and
 * Vercel's is UTC — so a 7pm appointment in New York renders on tomorrow's
 * page, and after midnight UTC the week jumps forward while it is still
 * Tuesday afternoon for the person reading it. Every date decision here runs
 * in the workspace's own zone (`workspaces.timezone`, set at onboarding),
 * which is the zone the professional actually works in.
 */

export type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let found = FORMATTERS.get(timeZone);
  if (!found) {
    found = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    FORMATTERS.set(timeZone, found);
  }
  return found;
}

/** What the wall clock in `timeZone` reads at this instant. */
export function partsIn(date: Date, timeZone: string): Parts {
  const found: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(date)) {
    if (part.type !== "literal") found[part.type] = part.value;
  }

  return {
    year: Number(found.year),
    month: Number(found.month),
    day: Number(found.day),
    hour: Number(found.hour) % 24,
    minute: Number(found.minute),
    second: Number(found.second),
  };
}

/** How far `timeZone` is from UTC at this instant, DST included. */
function offsetMs(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `timeZone` reads this.
 *
 * Two passes: the first guess uses the offset at the naive UTC instant, which
 * is wrong for the hours either side of a DST change, and the second corrects
 * it using the offset actually in force at the corrected instant.
 */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = new Date(naive - offsetMs(new Date(naive), timeZone));
  return new Date(naive - offsetMs(firstPass, timeZone));
}

/** Midnight that starts the given day in `timeZone`. */
export function startOfDayIn(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  return zonedTime(p.year, p.month, p.day, 0, 0, timeZone);
}

/** The same wall-clock time `days` later — not 24 hours later, which differs across DST. */
export function addDaysIn(date: Date, days: number, timeZone: string) {
  const p = partsIn(date, timeZone);
  return zonedTime(p.year, p.month, p.day + days, p.hour, p.minute, timeZone);
}

export function addMonthsIn(date: Date, months: number, timeZone: string) {
  const p = partsIn(date, timeZone);
  return zonedTime(p.year, p.month + months, 1, 0, 0, timeZone);
}

/** YYYY-MM-DD as the day reads in `timeZone` — the form the URL carries. */
export function isoDateIn(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** A YYYY-MM-DD from the URL, anchored at midday so no rounding lands it on the day before. */
export function fromIsoDate(iso: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = zonedTime(Number(match[1]), Number(match[2]), Number(match[3]), 12, 0, timeZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Day of the week in `timeZone`, 0 = Sunday. */
export function weekdayIn(date: Date, timeZone: string) {
  const p = partsIn(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

export function sameDayIn(a: Date, b: Date, timeZone: string) {
  return isoDateIn(a, timeZone) === isoDateIn(b, timeZone);
}
