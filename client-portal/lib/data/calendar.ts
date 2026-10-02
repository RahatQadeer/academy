import { cache } from "react";
import { after } from "next/server";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import {
  listPersonalEvents,
  syncGoogleCalendarIfStale,
} from "@/client-portal/lib/integrations/google-calendar";
import { syncOutlookCalendarIfStale } from "@/client-portal/lib/integrations/outlook-calendar";
import type { CalendarItem, CalendarKind } from "@/client-portal/types";

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  kind: string | null;
  location: string | null;
  attendees: string | null;
  external_calendar: string | null;
  linked_request_id: string | null;
  client_visible: boolean;
  whitbyos_requests: { title: string } | null;
};

const KINDS: CalendarKind[] = [
  "appointment",
  "meeting",
  "key_date",
  "travel",
  "deadline",
];

function toKind(raw: string | null): CalendarKind {
  return KINDS.includes(raw as CalendarKind) ? (raw as CalendarKind) : "appointment";
}

/**
 * An event with no time of its own.
 *
 * Google sends an all-day entry as a bare date, which whitbyos/033's sync
 * lands in the row as midnight to midnight — so the portal was rendering
 * "12:00 AM – 12:00 AM" for every one of them. Derived here exactly as
 * `isAllDay` in `whitbyos/lib/calendar.ts` derives it, from the shape of the
 * row: a column would be a second copy of the same fact, able to disagree.
 *
 * In the workspace's zone, not the server's, because midnight is a wall clock
 * reading and Vercel's is UTC.
 */
function isAllDay(start: string, end: string | null, timeZone: string): boolean {
  const clock = new Date(start).toLocaleTimeString("en-US", {
    timeZone,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (clock !== "00:00") return false;
  if (!end) return false;
  const span = new Date(end).getTime() - new Date(start).getTime();
  return span >= 23 * 3_600_000 && span % 3_600_000 === 0;
}

/**
 * Only events explicitly flagged `client_visible` appear. Internal professional
 * deadlines are never surfaced automatically — SRS 13.5.3.
 *
 * `kind` comes straight from the row rather than being guessed from `end_at` —
 * the professional sets it explicitly (Appointment / Meeting / Key Date, per
 * `whitbyos/lib/calendar-vocab.ts`) and it's what drives which portal tab an
 * event lands in.
 *
 * Since whitbyos/033 an event can also have arrived from a connected Google
 * calendar rather than having been typed into Whitby. It is the same row and
 * the same `client_visible` gate either way, so nothing here filters on it —
 * but `external_calendar` is carried through, because an all-day entry only
 * exists on that path and because a time that came from a calendar can move
 * without anybody on this side touching it.
 */
/*
 * Cached for the length of one request.
 *
 * Home composes Recent Activity from every area's reader while Action Needed
 * composes from three of the same ones, so an uncached read meant the same
 * rows fetched twice on one render. `cache()` is per-request, which is exactly
 * the lifetime wanted: within a render everybody sees one answer, and the next
 * request reads the table again.
 */
export const listCalendar = cache(async (): Promise<CalendarItem[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.CALENDAR;
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // an event passes through.
  if (!ctx.areas.calendar) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whitbyos_calendar_events")
    .select(
      "id, title, start_at, end_at, kind, location, attendees, external_calendar, linked_request_id, client_visible, whitbyos_requests(title)",
    )
    .eq("linked_client_id", ctx.clientId!)
    .eq("client_visible", true)
    .order("start_at", { ascending: true });

  if (error || !data) return [];

  // An event on a Request this person may not open is not theirs to see.
  // RLS on events checks the client account only, while the Request embed
  // runs under `portal_can_see_request` (SRS 13.14.14) — so a linked Request
  // that comes back empty is one that is private to somebody else, and its
  // appointments are as private as it is. Events with no Request at all are
  // untouched: they were shared with the account, not through a Request.
  const readable = (data as unknown as EventRow[]).filter(
    (row) => !row.linked_request_id || row.whitbyos_requests !== null,
  );

  return readable.map((row) => ({
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    kind: toKind(row.kind),
    requestId: row.linked_request_id,
    requestTitle: row.whitbyos_requests?.title ?? null,
    location: row.location,
    attendees: row.attendees,
    allDay: isAllDay(row.start_at, row.end_at, ctx.timezone),
    externalCalendar: row.external_calendar,
  }));
});

/**
 * The client's own events, from a calendar they connected on Integrations.
 *
 * Kept apart from `listCalendar`, which Request screens read too: these belong
 * to no Request and are nobody's but this person's, so only the Calendar
 * screen asks for them.
 *
 * What is stored is drawn now; a fresh read of the connected calendars runs
 * after the response — the way Whitby's own calendar keeps itself current as
 * it is opened — so opening the Calendar never waits on a provider.
 *
 * Both are asked, because a client may keep one life in Google and another in
 * Outlook. Each is throttled and each returns at once when there is nothing
 * connected, so asking for both costs nothing when only one is.
 */
export async function listPersonalCalendar(): Promise<CalendarItem[]> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.PERSONAL_CALENDAR;
  if (!ctx.contactId) return [];

  const contactId = ctx.contactId;
  const timeZone = ctx.timezone;
  after(() => syncGoogleCalendarIfStale(contactId, timeZone));
  after(() => syncOutlookCalendarIfStale(contactId, timeZone));

  return listPersonalEvents(contactId);
}

export type CalendarTab =
  | "all"
  | "upcoming"
  | "meetings"
  | "key-dates"
  | "by-request"
  | "past";

/**
 * When an event stops being upcoming. An all-day entry ends at the midnight
 * that closes it, so one that started this morning is still today's rather
 * than already past — which is the same `end_at` every other event uses.
 */
function endOf(item: CalendarItem): number {
  return new Date(item.endAt ?? item.startAt).getTime();
}

const MEETINGS = new Set<CalendarKind>(["meeting", "appointment"]);
const KEY_DATES = new Set<CalendarKind>(["key_date", "deadline"]);

export function filterCalendar(
  items: CalendarItem[],
  tab: CalendarTab,
  now: Date = new Date(),
): CalendarItem[] {
  // Compared as instants, not strings: Postgres hands back `+00:00` and
  // `toISOString` writes `.000Z`, which do not sort against each other.
  const at = now.getTime();
  const byStart = (a: CalendarItem, b: CalendarItem) =>
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  const upcoming = items.filter((item) => endOf(item) >= at).sort(byStart);

  const past = items.filter((item) => endOf(item) < at).sort((a, b) => byStart(b, a));

  switch (tab) {
    // Everything on the calendar in one list: what is coming, soonest first,
    // and behind it what has been, most recent first. The tabs below it each
    // hide something, and a client who opens Meetings, finds nothing, opens
    // Key Dates, finds nothing, has learned only that they had to look twice.
    // This is the list that answers "is there anything at all" in one read.
    case "all":
      return [...upcoming, ...past];
    case "past":
      return past;
    case "meetings":
      return upcoming.filter((item) => MEETINGS.has(item.kind));
    case "key-dates":
      return upcoming.filter((item) => KEY_DATES.has(item.kind));
    // Every upcoming event, grouped. Events shared without a Request used to
    // be dropped from this tab entirely; they now sit in their own group.
    case "by-request":
    default:
      return upcoming;
  }
}

/**
 * How many events each tab holds, counted once over the same list the tabs
 * draw from.
 *
 * The tabs carry these numbers so that "is there anything under Meetings" is
 * answered by looking at the row rather than by opening it. A client used to
 * have to visit every tab in turn to find out which ones were empty, which is
 * four navigations to learn a fact the server already knows.
 *
 * `by-request` counts the events that belong to a Request rather than every
 * event it lists, because that is the number the tab is about — the rest are
 * there only so the list is not missing them.
 */
export function countCalendar(
  items: CalendarItem[],
  now: Date = new Date(),
): Record<CalendarTab, number> {
  return {
    all: filterCalendar(items, "all", now).length,
    upcoming: filterCalendar(items, "upcoming", now).length,
    meetings: filterCalendar(items, "meetings", now).length,
    "key-dates": filterCalendar(items, "key-dates", now).length,
    "by-request": filterCalendar(items, "by-request", now).filter(
      (item) => item.requestId,
    ).length,
    past: filterCalendar(items, "past", now).length,
  };
}
