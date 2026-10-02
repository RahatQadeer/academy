import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { GOOGLE_PROVIDER, syncGoogleWindow } from "@/whitbyos/lib/google-calendar";
import {
  addDaysIn,
  addMonthsIn,
  fromIsoDate,
  isoDateIn,
  partsIn,
  startOfDayIn,
  weekdayIn,
  zonedTime,
} from "@/whitbyos/lib/zoned";

export type CalendarView = "day" | "week" | "month";

export const VIEWS: CalendarView[] = ["day", "week", "month"];

export type CalendarEvent = {
  id: string;
  title: string;
  start_at: string | null;
  end_at: string | null;
  kind: string;
  attendees: string | null;
  location: string | null;
  externalCalendar: string | null;
  externalEventId: string | null;
  clientVisible: boolean;
  requestId: string | null;
  requestTitle: string | null;
  clientId: string | null;
  clientName: string | null;
  allDay: boolean;
};

export type CalendarWindow = {
  /** What is queried and drawn — for Month, the whole six-week grid. */
  start: Date;
  end: Date;
  /** The period the view is actually of, which the range label names. */
  rangeStart: Date;
  rangeEnd: Date;
};

export type CalendarBoard = {
  view: CalendarView;
  timezone: string;
  anchor: Date;
  today: Date;
  window: CalendarWindow;
  events: CalendarEvent[];
  connected: string[];
  googleAccount: string | null;
};

export type CalendarResult =
  | { ok: true; board: CalendarBoard }
  | { ok: false; error: string };

const SELECT =
  "id, title, start_at, end_at, kind, attendees, location, external_calendar, external_event_id, client_visible, linked_request_id, linked_client_id, request:whitbyos_requests!linked_request_id (id, title), client:whitbyos_clients!linked_client_id (id, name)";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * An event with no time of its own.
 *
 * Google sends these as a bare date, which lands in the row as midnight to
 * midnight; the Figma shows "All day" where the time would go. Derived rather
 * than stored, because the only thing distinguishing one is the shape of its
 * own start and end, and a column would be a second copy of that able to
 * disagree with it.
 */
function isAllDay(start: string | null, end: string | null, timeZone: string) {
  if (!start) return false;
  const from = partsIn(new Date(start), timeZone);
  if (from.hour !== 0 || from.minute !== 0) return false;
  if (!end) return false;
  const span = new Date(end).getTime() - new Date(start).getTime();
  return span >= 23 * 3_600_000 && span % 3_600_000 === 0;
}

function toEvent(row: Record<string, unknown>, timeZone: string): CalendarEvent {
  const request = firstOf(row.request as { id: string; title: string } | null);
  const client = firstOf(row.client as { id: string; name: string } | null);
  const start = (row.start_at as string | null) ?? null;
  const end = (row.end_at as string | null) ?? null;

  return {
    id: row.id as string,
    title: row.title as string,
    start_at: start,
    end_at: end,
    kind: (row.kind as string) ?? "appointment",
    attendees: (row.attendees as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    externalCalendar: (row.external_calendar as string | null) ?? null,
    externalEventId: (row.external_event_id as string | null) ?? null,
    clientVisible: Boolean(row.client_visible),
    requestId: (row.linked_request_id as string | null) ?? null,
    requestTitle: request?.title ?? null,
    clientId: (row.linked_client_id as string | null) ?? null,
    clientName: client?.name ?? null,
    allDay: isAllDay(start, end, timeZone),
  };
}

/**
 * The span a view covers, in the workspace's own zone.
 *
 * Month asks for the whole grid rather than the month, because the grid draws
 * the days either side of it and an event on the 1st of April is visible on
 * March's screen. Weeks run Sunday to Saturday, as the Month view's own
 * column headings do — the two views disagreeing about where a week starts
 * would be a bug you only notice at the end of a month.
 */
export function windowFor(view: CalendarView, anchor: Date, timeZone: string): CalendarWindow {
  if (view === "day") {
    const start = startOfDayIn(anchor, timeZone);
    const end = addDaysIn(start, 1, timeZone);
    return { start, end, rangeStart: start, rangeEnd: end };
  }

  if (view === "week") {
    // Monday to Sunday, which is how the reference labels it: "Week of March
    // 24 – 30" runs from a Monday to the Sunday after. The Month grid's own
    // columns start on Sunday, also as drawn — the two views disagree in the
    // export, and following it is the smaller surprise.
    const offset = (weekdayIn(anchor, timeZone) + 6) % 7;
    const start = addDaysIn(startOfDayIn(anchor, timeZone), -offset, timeZone);
    const end = addDaysIn(start, 7, timeZone);
    return { start, end, rangeStart: start, rangeEnd: end };
  }

  const p = partsIn(anchor, timeZone);
  const rangeStart = zonedTime(p.year, p.month, 1, 0, 0, timeZone);
  const rangeEnd = addMonthsIn(rangeStart, 1, timeZone);
  const start = addDaysIn(rangeStart, -weekdayIn(rangeStart, timeZone), timeZone);
  const end = addDaysIn(start, 42, timeZone);
  return { start, end, rangeStart, rangeEnd };
}

/**
 * Screens 8, 8a and 8b — the workspace's calendar across every request.
 *
 * A connected calendar is pulled in on the way, for the window being looked at
 * rather than for all time: §11.2 makes it authoritative, so what the screen
 * shows has to be what Google has now, not what it had at some last sync. A
 * failed pull is not fatal — whatever Whitby already holds still draws, and
 * the strip along the top says the connection needs attention.
 */
export async function loadCalendar(
  view: CalendarView,
  dateParam: string | undefined,
  /**
   * Whether to pull the connected calendar on the way. A dialog re-renders the
   * screen behind it, which had just synced — so opening one does not go back
   * to Google, and a click never waits on a network round-trip it does not
   * need.
   */
  sync = true,
): Promise<CalendarResult> {
  const workspaceId = await getCurrentWorkspaceId();
  const supabase = await createClient();

  const timezone = await workspaceTimezone(workspaceId);
  const today = new Date();
  const anchor = (dateParam ? fromIsoDate(dateParam, timezone) : null) ?? today;
  const window = windowFor(view, anchor, timezone);

  const empty: CalendarBoard = {
    view,
    timezone,
    anchor,
    today,
    window,
    events: [],
    connected: [],
    googleAccount: null,
  };

  if (!workspaceId) return { ok: true, board: empty };

  // Which calendars this workspace has actually connected (§11.1.7).
  const { data: integrations } = await supabase
    .from("whitbyos_integrations")
    .select("provider, status, connected_account")
    .eq("workspace_id", workspaceId)
    .in("provider", ["google_calendar", "outlook_calendar"]);

  const connected = (integrations ?? [])
    .filter((row) => row.status === "connected")
    .map((row) => row.provider as string);

  const googleAccount =
    (integrations ?? []).find((row) => row.provider === GOOGLE_PROVIDER)?.connected_account ?? null;

  if (sync && connected.includes(GOOGLE_PROVIDER)) {
    await syncGoogleWindow(workspaceId, window.start, window.end, timezone);
  }

  /*
   * Whose week this is, decided once on Workspace Overview.
   *
   * The Calendar showed every appointment in the firm while one client's
   * workspace was open, which is the one screen left doing that: the rest of
   * Whitby answers "whose work am I looking at" the same way everywhere. An
   * event tied to no client is the firm's own, and belongs to whoever is
   * looking — it is not another client's business being shown under this one.
   */
  const openClient = await getOpenClientId();

  let query = supabase
    .from("whitbyos_calendar_events")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .gte("start_at", window.start.toISOString())
    .lt("start_at", window.end.toISOString());

  if (openClient) {
    query = query.or(`linked_client_id.eq.${openClient},linked_client_id.is.null`);
  }

  const { data, error } = await query.order("start_at");

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    board: {
      ...empty,
      events: (data ?? []).map((row) => toEvent(row as Record<string, unknown>, timezone)),
      connected,
      googleAccount: googleAccount as string | null,
    },
  };
}

/** Screen 8.1 — one event. */
export async function getEvent(
  eventId: string,
  timeZone: string,
): Promise<CalendarEvent | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_calendar_events")
    .select(`${SELECT}, workspace_id`)
    .eq("id", eventId)
    .maybeSingle();

  if (!data || data.workspace_id !== workspaceId) return null;
  return toEvent(data as Record<string, unknown>, timeZone);
}

export async function workspaceTimezone(workspaceId: string | null) {
  if (!workspaceId) return "UTC";
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("timezone")
    .eq("id", workspaceId)
    .maybeSingle();
  return (data?.timezone as string) || "UTC";
}

/** The zone the calendar is drawn in, for callers that have no board yet. */
export async function currentTimezone() {
  return workspaceTimezone(await getCurrentWorkspaceId());
}

/** Groups a window's events by day, in order, skipping days with nothing on them. */
export function byDay(events: CalendarEvent[], timeZone: string) {
  const days = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    if (!event.start_at) continue;
    const key = isoDateIn(new Date(event.start_at), timeZone);
    const list = days.get(key) ?? [];
    list.push(event);
    days.set(key, list);
  }

  return [...days.entries()].map(([key, list]) => ({
    key,
    day: fromIsoDate(key, timeZone) ?? new Date(key),
    events: list,
  }));
}

/** Every event of one day, all-day first, then in time order. */
export function eventsOn(events: CalendarEvent[], day: Date, timeZone: string) {
  const key = isoDateIn(day, timeZone);
  return events.filter(
    (event) => event.start_at && isoDateIn(new Date(event.start_at), timeZone) === key,
  );
}

/** Weeks of the Month grid, each seven days long, starting Sunday. */
export function weeksOf(window: CalendarWindow, timeZone: string) {
  const weeks: Date[][] = [];
  let cursor = window.start;

  while (cursor.getTime() < window.end.getTime()) {
    const week: Date[] = [];
    for (let index = 0; index < 7; index += 1) {
      week.push(cursor);
      cursor = addDaysIn(cursor, 1, timeZone);
    }
    weeks.push(week);
  }

  // Six rows are drawn only when the month needs them; most need five.
  while (weeks.length > 4) {
    const last = weeks[weeks.length - 1];
    const spillsOver = last.every(
      (day) => day.getTime() >= window.rangeEnd.getTime() || day.getTime() < window.rangeStart.getTime(),
    );
    if (!spillsOver) break;
    weeks.pop();
  }

  return weeks;
}
