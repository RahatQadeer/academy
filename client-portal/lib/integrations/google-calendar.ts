import { createServiceClient } from "@/base/lib/supabase/service";
import { zonedTime } from "@/whitbyos/lib/zoned";
import type { CalendarItem } from "@/client-portal/types";
import { settingOn } from "./catalog";
import { grantFor, markNeedsAttention, markSynced } from "./connection";

/**
 * A client's Google Calendar — `syncGoogleWindow` in `whitbyos/lib/google-calendar.ts`,
 * for one person.
 *
 * The same rules as Whitby's: Google is the truth, a window is read and upserted
 * on Google's event id, recurring series arrive expanded into their occurrences,
 * and an event Google no longer has inside the window is deleted rather than
 * left on the Calendar to be planned around.
 *
 * What differs is where it lands. Whitby's sync writes into the workspace's own
 * calendar, where the team files events against Requests and chooses which a
 * client may see. A client's calendar is theirs: it lands in
 * `client_portal_calendar_events`, which only this person's portal reads, and
 * the practice sees none of it.
 *
 * Read-only. Whitby also creates and edits Google events, because a
 * professional schedules from Whitby; the portal's Calendar schedules nothing,
 * so it neither asks for nor uses write access.
 */

const API = "https://www.googleapis.com/calendar/v3";
/** How far either side of today a sync reads. */
const PAST_DAYS = 60;
const FUTURE_DAYS = 365;
const STALE_AFTER_MS = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string; self?: boolean; responseStatus?: string }[];
};

/** An all-day entry is a bare date: midnight in the reader's zone, as Whitby treats it. */
function instantOf(edge: GoogleEvent["start"], timeZone: string) {
  if (edge?.dateTime) return new Date(edge.dateTime).toISOString();
  if (edge?.date) {
    const [year, month, day] = edge.date.split("-").map(Number);
    return zonedTime(year, month, day, 0, 0, timeZone).toISOString();
  }
  return null;
}

function attendeeLine(event: GoogleEvent) {
  const names = (event.attendees ?? [])
    .filter((person) => !person.self)
    .map((person) => person.displayName || person.email)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

export async function syncGoogleCalendar(
  contactId: string,
  timeZone: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "The server is missing its credentials." };

  const { data: integration } = await supabase
    .from("client_portal_integrations")
    .select("sync_settings")
    .eq("contact_id", contactId)
    .eq("provider", "google_calendar")
    .neq("status", "disconnected")
    .maybeSingle();

  if (!integration) return { ok: false, error: "Google Calendar is not connected." };

  const grant = await grantFor(contactId, "google_calendar");
  if (!grant) return { ok: false, error: "Google Calendar is not connected." };

  const showDeclined = settingOn(
    (integration.sync_settings as Record<string, boolean>) ?? {},
    "show_declined",
    "google_calendar",
  );

  const start = new Date(Date.now() - PAST_DAYS * DAY);
  const end = new Date(Date.now() + FUTURE_DAYS * DAY);

  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;

  // Paged, because a year of a busy calendar is more than one page of 250.
  do {
    const url = new URL(`${API}/calendars/${encodeURIComponent(grant.calendarId)}/events`);
    url.searchParams.set("timeMin", start.toISOString());
    url.searchParams.set("timeMax", end.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${grant.accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      await markNeedsAttention(
        contactId,
        "google_calendar",
        "Google Calendar did not answer. Try connecting it again.",
      );
      return { ok: false, error: (await response.text()).slice(0, 200) };
    }

    const page = (await response.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken && items.length < 2500);

  const now = new Date().toISOString();

  const rows = items.flatMap((event) => {
    const startAt = instantOf(event.start, timeZone);
    if (!event.id || event.status === "cancelled" || !startAt) return [];

    const declined = (event.attendees ?? []).some(
      (person) => person.self && person.responseStatus === "declined",
    );
    if (declined && !showDeclined) return [];

    return [
      {
        contact_id: contactId,
        provider: "google_calendar",
        external_event_id: event.id,
        title: event.summary?.trim() || "(No title)",
        start_at: startAt,
        end_at: instantOf(event.end, timeZone),
        all_day: Boolean(event.start?.date && !event.start?.dateTime),
        location: event.location ?? null,
        attendees: attendeeLine(event),
        html_link: event.htmlLink ?? null,
        declined,
        updated_at: now,
      },
    ];
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("client_portal_calendar_events")
      .upsert(rows, { onConflict: "contact_id,provider,external_event_id" });
    if (error) return { ok: false, error: error.message };
  }

  // Gone from Google — or now hidden as declined — is gone from the Calendar.
  const kept = new Set(rows.map((row) => row.external_event_id));
  const { data: stored } = await supabase
    .from("client_portal_calendar_events")
    .select("id, external_event_id")
    .eq("contact_id", contactId)
    .eq("provider", "google_calendar")
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString());

  const gone = (stored ?? [])
    .filter((row) => !kept.has(row.external_event_id as string))
    .map((row) => row.id as string);

  if (gone.length > 0) {
    await supabase.from("client_portal_calendar_events").delete().in("id", gone);
  }

  await markSynced(contactId, "google_calendar");
  return { ok: true, count: rows.length };
}

/** Sync, if the last one is old enough to be worth repeating. Never throws. */
export async function syncGoogleCalendarIfStale(contactId: string | null, timeZone: string) {
  if (!contactId) return;
  try {
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("client_portal_integrations")
      .select("last_sync_at")
      .eq("contact_id", contactId)
      .eq("provider", "google_calendar")
      .eq("status", "connected")
      .maybeSingle();

    if (!data) return;
    const last = data.last_sync_at ? new Date(data.last_sync_at as string).getTime() : 0;
    if (Date.now() - last < STALE_AFTER_MS) return;

    await syncGoogleCalendar(contactId, timeZone);
  } catch {
    // A calendar that cannot be read must never take the Calendar down with it.
  }
}

/** This person's own events, as the portal Calendar draws them. */
export async function listPersonalEvents(contactId: string): Promise<CalendarItem[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("client_portal_calendar_events")
    .select("id, provider, title, start_at, end_at, all_day, location, attendees, html_link, declined")
    .eq("contact_id", contactId)
    .order("start_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: `personal-${row.id as string}`,
    title: row.title as string,
    startAt: row.start_at as string,
    endAt: (row.end_at as string | null) ?? null,
    kind: "appointment" as const,
    requestId: null,
    requestTitle: null,
    location: (row.location as string | null) ?? null,
    attendees: (row.attendees as string | null) ?? null,
    allDay: row.all_day === true,
    externalCalendar: row.provider as string,
    personal: {
      href: (row.html_link as string | null) ?? null,
      declined: row.declined === true,
    },
  }));
}
