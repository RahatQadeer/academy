// Fixture timestamps are relative to load time so the demo account never looks
// stale. Real query paths never import this.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const base = () => Date.now();

export function hoursAgo(n: number): string {
  return new Date(base() - n * HOUR).toISOString();
}

export function daysAgo(n: number): string {
  return new Date(base() - n * DAY).toISOString();
}

export function daysAhead(n: number, atHourUtc = 15): string {
  const d = new Date(base() + n * DAY);
  d.setUTCHours(atHourUtc, 0, 0, 0);
  return d.toISOString();
}

/** Next occurrence of a weekday (0=Sun … 5=Fri), used for "Due Friday" copy. */
export function nextWeekday(weekday: number, atHourUtc = 17): string {
  const d = new Date(base());
  const delta = (weekday - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + delta);
  d.setUTCHours(atHourUtc, 0, 0, 0);
  return d.toISOString();
}
