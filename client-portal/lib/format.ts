/**
 * Every date the portal draws belongs to somebody else's day.
 *
 * A calendar event, a due date and a message timestamp were all decided in the
 * professional's own zone (`workspaces.timezone`), which is what
 * `whitbyos/lib/zoned.ts` renders them in. Formatting them in UTC here put a
 * 9:00 AM appointment on screen as 1:00 PM, and an evening one on the wrong
 * day entirely.
 *
 * So every formatter takes the zone, and defaults to UTC — which is what it
 * did before, so a caller that has no context yet is no worse off than it was.
 * The zone comes from `PortalContext.timezone`.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** "2h ago", "4d ago", "2w ago" — matches the design's timestamp style. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = now.getTime() - then;

  if (delta < 0) return upcomingTime(delta);
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < WEEK) return `${Math.floor(delta / DAY)}d ago`;
  if (delta < 5 * WEEK) return `${Math.floor(delta / WEEK)}w ago`;
  return shortDate(iso);
}

function upcomingTime(delta: number): string {
  const ahead = Math.abs(delta);
  if (ahead < HOUR) return `in ${Math.max(1, Math.floor(ahead / MINUTE))}m`;
  if (ahead < DAY) return `in ${Math.floor(ahead / HOUR)}h`;
  return `in ${Math.floor(ahead / DAY)}d`;
}

/** "Jul 24" / "Jul 24, 2024" when the year differs from now. */
export function shortDate(
  iso: string,
  now: Date = new Date(),
  timeZone = "UTC",
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const yearIn = (d: Date) => d.toLocaleDateString("en-US", { timeZone, year: "numeric" });
  const sameYear = yearIn(date) === yearIn(now);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone,
  });
}

export function longDate(iso: string, timeZone = "UTC"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone,
  });
}

export function weekdayShort(iso: string, timeZone = "UTC"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleDateString("en-US", { weekday: "short", timeZone })
    .toUpperCase();
}

/**
 * "9:00 – 9:45 AM", dropping the first meridiem when both ends share it —
 * the same reading `whitbyos/lib/calendar-format.ts` writes, so an event does
 * not render two different ways on the two sides of it.
 */
export function timeRange(
  startIso: string,
  endIso: string | null,
  timeZone = "UTC",
): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return "";
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    });
  if (!endIso) return fmt(start);
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return fmt(start);

  const from = fmt(start);
  const to = fmt(end);
  const sameHalf = from.slice(-2) === to.slice(-2);
  return `${sameHalf ? from.replace(/\s?[AP]M$/, "") : from} – ${to}`;
}

export function money(cents: number, currency = "USD"): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
}

/** Day-level due copy: "Due Friday", "Due today", "Overdue". */
export function dueLabel(
  iso: string | null,
  now: Date = new Date(),
  timeZone = "UTC",
): string | null {
  if (!iso) return null;
  const days = daysUntil(iso, now, timeZone);
  if (days === null) return null;
  const due = new Date(iso);

  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 6) {
    return `Due ${due.toLocaleDateString("en-US", { weekday: "long", timeZone })}`;
  }
  return `Due ${shortDate(iso, now, timeZone)}`;
}

/**
 * Whole days from today to `iso`, counted in `timeZone` — negative for a date
 * that has passed, null for no date and for anything unparseable.
 *
 * Whole days as the two dates *read* in the zone, not as the two instants
 * divide: "tomorrow" is a change of date, and 23 hours across a DST boundary
 * is still one day later. `dueLabel` turns this into words; a screen that
 * files tasks under Overdue, Today, This week and Later needs the number.
 */
export function daysUntil(
  iso: string | null,
  now: Date = new Date(),
  timeZone = "UTC",
): number | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((dayNumber(due, timeZone) - dayNumber(now, timeZone)) / DAY);
}

/** The calendar day a date falls on in `timeZone`, as a UTC-midnight stamp. */
function dayNumber(date: Date, timeZone: string) {
  const [month, day, year] = date
    .toLocaleDateString("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/")
    .map(Number);
  return Date.UTC(year, month - 1, day);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/**
 * Somebody's name with each word's first letter raised.
 *
 * A contact is typed into Whitby by whoever added them, and plenty arrive as
 * "rohail client" — which the portal then greeted as "Welcome back, rohail"
 * and put in lowercase on the bar beside a capitalised workspace name.
 *
 * It only ever raises: the rest of each word is left exactly as typed, so
 * "McDonald", "van Rijn" and an initialled "RJ Patel" survive a pass through
 * it. Nothing here tries to guess a person's real capitalisation beyond the
 * one letter a sentence would capitalise anyway.
 */
export function properName(name: string): string {
  return name.replace(/(^|[\s'-])(\p{Ll})/gu, (_, lead: string, letter: string) =>
    lead + letter.toUpperCase(),
  );
}
