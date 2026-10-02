import { windowFor, type CalendarView, type CalendarWindow } from "@/whitbyos/lib/calendar";
import { dayHeading } from "@/whitbyos/lib/calendar-format";
import { addDaysIn, addMonthsIn, fromIsoDate, isoDateIn } from "@/whitbyos/lib/zoned";
import type { CalendarItem } from "@/client-portal/types";

/**
 * The Day, Week and Month views, windowed exactly as Whitby windows its own.
 *
 * Whitby's `windowFor` and `weeksOf` are used as they are rather than copied:
 * a client and their professional looking at "the week of the 24th" must be
 * looking at the same seven days, and two copies of the arithmetic are two
 * places for a week to start on a different day.
 */

export type { CalendarView, CalendarWindow };
export { dayHeading };

export const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

export function viewWindow(view: CalendarView, dateParam: string | undefined, timeZone: string) {
  const anchor = (dateParam ? fromIsoDate(dateParam, timeZone) : null) ?? new Date();
  return { anchor, window: windowFor(view, anchor, timeZone) };
}

/** The date one step either side, in the unit the view is in. */
export function stepFrom(view: CalendarView, anchor: Date, amount: number, timeZone: string) {
  const next =
    view === "month"
      ? addMonthsIn(anchor, amount, timeZone)
      : addDaysIn(anchor, amount * (view === "week" ? 7 : 1), timeZone);
  return isoDateIn(next, timeZone);
}

function startOf(item: CalendarItem) {
  return new Date(item.startAt).getTime();
}

/** All-day first, then in time order — the order a day is read in. */
function dayOrder(a: CalendarItem, b: CalendarItem) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return startOf(a) - startOf(b);
}

/** The events that start inside the window, as Whitby queries them. */
export function inWindow(items: CalendarItem[], window: CalendarWindow) {
  const from = window.start.getTime();
  const to = window.end.getTime();
  return items
    .filter((item) => {
      const at = startOf(item);
      return at >= from && at < to;
    })
    .sort(dayOrder);
}

/** Groups events by the day they start on, skipping days with nothing on them. */
export function byDay(items: CalendarItem[], timeZone: string) {
  const days = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = isoDateIn(new Date(item.startAt), timeZone);
    const list = days.get(key) ?? [];
    list.push(item);
    days.set(key, list);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, list]) => ({
      key,
      day: fromIsoDate(key, timeZone) ?? new Date(key),
      items: list.sort(dayOrder),
    }));
}

/** Every event of one day. */
export function itemsOn(items: CalendarItem[], day: Date, timeZone: string) {
  const key = isoDateIn(day, timeZone);
  return items
    .filter((item) => isoDateIn(new Date(item.startAt), timeZone) === key)
    .sort(dayOrder);
}
