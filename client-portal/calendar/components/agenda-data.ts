import { isoDateIn } from "@/whitbyos/lib/zoned";
import type { CalendarTab } from "@/client-portal/lib/data/calendar";
import type { CalendarItem } from "@/client-portal/types";

/*
 * What the server screen and the client agenda both need.
 *
 * Its own module rather than exports from `Agenda.tsx`: that file is
 * "use client", and a plain function exported from one can be passed across
 * the boundary but not called on the server.
 */

const BASE = "/client-portal/calendar";

/**
 * The order the chips run in, and the tab a bare `?view=list` means.
 *
 * All leads, because it is the only one of the six that cannot be empty while
 * the calendar has something on it — every other chip hides something, and a
 * client who lands on one of those and finds it empty has learned nothing
 * about the calendar, only about that chip.
 */
export const AGENDA_TABS: CalendarTab[] = [
  "all",
  "upcoming",
  "meetings",
  "key-dates",
  "by-request",
  "past",
];

export const DEFAULT_AGENDA_TAB: CalendarTab = "all";

/** Short enough for a chip. The long form is the subtitle above the list. */
export const AGENDA_LABEL: Record<CalendarTab, string> = {
  all: "All",
  upcoming: "Upcoming",
  meetings: "Meetings",
  "key-dates": "Key Dates",
  "by-request": "By Request",
  past: "Past",
};

export const AGENDA_SUBTITLE: Record<CalendarTab, string> = {
  all: "Everything on your calendar — what is coming, then what has been.",
  upcoming: "Everything your team has scheduled with you, soonest first.",
  meetings: "Calls, interviews and appointments.",
  "key-dates": "Deadlines and dates that matter, across all your requests.",
  "by-request": "What is scheduled, under the request it belongs to.",
  past: "Events and dates that have already passed.",
};

export function agendaHref(params: {
  tab?: CalendarTab;
  q?: string;
  event?: string;
}): string {
  const query = new URLSearchParams({ view: "list" });
  if (params.tab && params.tab !== DEFAULT_AGENDA_TAB) query.set("tab", params.tab);
  if (params.q) query.set("q", params.q);
  if (params.event) query.set("event", params.event);
  return `${BASE}?${query.toString()}`;
}

const UNLINKED = "Not linked to a request";

/**
 * The By Request grouping, keyed by Request id rather than title — two
 * Requests can share a name — and with the unlinked group last, after the work
 * it is not part of.
 *
 * It lives here rather than beside the queries in `lib/data/calendar.ts`
 * because the agenda that calls it is a client component, and that module
 * reaches Supabase and `next/server` the moment it is imported.
 */
export function groupByRequest(items: CalendarItem[]): [string, CalendarItem[]][] {
  const groups = new Map<string, { title: string; items: CalendarItem[] }>();
  for (const item of items) {
    const key = item.requestId ?? "";
    const group = groups.get(key) ?? {
      title: item.requestId ? (item.requestTitle ?? "Request") : UNLINKED,
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  }
  const linked = [...groups.entries()].filter(([key]) => key !== "");
  const unlinked = groups.get("");
  return [
    ...linked.map(([, group]) => [group.title, group.items] as [string, CalendarItem[]]),
    ...(unlinked ? [[unlinked.title, unlinked.items] as [string, CalendarItem[]]] : []),
  ];
}

export type AgendaGroup = {
  key: string;
  label: string;
  /** The day this group is, where it is a day: used to mark the ones gone by. */
  past: boolean;
  items: CalendarItem[];
};

/**
 * The headings a list is broken under.
 *
 * By Request keeps the grouping it is named for; every other tab is grouped by
 * day, which is how an agenda is read — a wall of rows with the date repeated
 * down the left of each one is a table, and the date is the only thing in it
 * the eye is actually using to navigate.
 *
 * `today` and `tomorrow` arrive as ISO days decided on the server, so the two
 * renders cannot disagree about which day it is and the labels never flicker
 * on hydration.
 */
export function groupAgenda(
  items: CalendarItem[],
  tab: CalendarTab,
  timeZone: string,
  today: string,
  tomorrow: string,
): AgendaGroup[] {
  if (tab === "by-request") {
    return groupByRequest(items).map(([title, group]) => ({
      key: `request:${group[0]?.requestId ?? "unlinked"}`,
      label: title,
      past: false,
      items: group,
    }));
  }

  const groups: AgendaGroup[] = [];
  for (const item of items) {
    const day = isoDateIn(new Date(item.startAt), timeZone);
    const last = groups[groups.length - 1];
    if (last && last.key === day) {
      last.items.push(item);
      continue;
    }
    groups.push({
      key: day,
      label: dayLabel(item.startAt, day, timeZone, today, tomorrow),
      past: day < today,
      items: [item],
    });
  }
  return groups;
}

function dayLabel(
  iso: string,
  day: string,
  timeZone: string,
  today: string,
  tomorrow: string,
): string {
  if (day === today) return "Today";
  if (day === tomorrow) return "Tomorrow";
  const date = new Date(iso);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone,
  });
}

/**
 * Whether an event answers what was typed into the search box.
 *
 * Everything the row puts on screen is searchable — the title, where it is,
 * who is coming and the Request it belongs to — because a client searching
 * "Heathrow" is searching for what they can see, not for a title field.
 */
export function matchesAgendaSearch(item: CalendarItem, needle: string): boolean {
  if (!needle) return true;
  return [item.title, item.location, item.attendees, item.requestTitle].some(
    (field) => field?.toLowerCase().includes(needle),
  );
}
