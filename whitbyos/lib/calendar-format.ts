import type { CalendarView } from "@/whitbyos/lib/calendar";
import { partsIn } from "@/whitbyos/lib/zoned";

/**
 * Everything the calendar screens read off a date, in the workspace's zone.
 *
 * Kept apart from `calendar.ts` so the dialogs and the view components can use
 * it without pulling a Supabase client into their module graph.
 */

export function timeLabel(startAt: string | null, allDay: boolean, timeZone: string) {
  if (allDay) return "All day";
  if (!startAt) return "No date";
  return new Date(startAt).toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Monday, March 24" — the heading over a day's events. */
export function dayHeading(day: Date, timeZone: string) {
  return day.toLocaleDateString("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "Week of March 24 – 30", "Monday, March 24", "March 2025". */
export function rangeLabel(view: CalendarView, start: Date, end: Date, timeZone: string) {
  if (view === "day") return dayHeading(start, timeZone);

  if (view === "month") {
    return start.toLocaleDateString("en-US", { timeZone, month: "long", year: "numeric" });
  }

  const last = new Date(end.getTime() - 86_400_000);
  const sameMonth =
    start.toLocaleDateString("en-US", { timeZone, month: "numeric" }) ===
    last.toLocaleDateString("en-US", { timeZone, month: "numeric" });

  const from = start.toLocaleDateString("en-US", { timeZone, month: "long", day: "numeric" });
  const to = last.toLocaleDateString(
    "en-US",
    sameMonth
      ? { timeZone, day: "numeric" }
      : { timeZone, month: "long", day: "numeric" },
  );

  return `Week of ${from} – ${to}`;
}

/** "Monday, March 24 · 9:00 – 9:45 AM" under the title on Screen 8.1. */
export function whenLine(
  startAt: string | null,
  endAt: string | null,
  allDay: boolean,
  timeZone: string,
) {
  if (!startAt) return "No date set";
  const start = new Date(startAt);
  const day = dayHeading(start, timeZone);
  if (allDay) return `${day} · All day`;

  const from = start.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  if (!endAt) return `${day} · ${from}`;

  const end = new Date(endAt);
  const to = end.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });

  // "9:00 – 9:45 AM" rather than "9:00 AM – 9:45 AM" when the meridiem is the
  // same at both ends, which is how the reference writes it.
  const sameHalf =
    start.toLocaleTimeString("en-US", { timeZone, hour: "numeric", hour12: true }).slice(-2) ===
    end.toLocaleTimeString("en-US", { timeZone, hour: "numeric", hour12: true }).slice(-2);

  return `${day} · ${sameHalf ? from.replace(/\s?[AP]M$/, "") : from} – ${to}`;
}

/** The hour an event sits in, in the workspace's zone. */
export function hourOf(startAt: string, timeZone: string) {
  return partsIn(new Date(startAt), timeZone).hour;
}

/** "7:00 AM" down the left of the Day grid. */
export function hourLabel(hour: number) {
  const meridiem = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${meridiem}`;
}
