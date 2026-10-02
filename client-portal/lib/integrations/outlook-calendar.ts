import { createServiceClient } from "@/base/lib/supabase/service";
import { zonedTime } from "@/whitbyos/lib/zoned";
import { settingOn } from "./catalog";
import { grantFor, markNeedsAttention, markSynced } from "./connection";

/**
 * A client's Outlook Calendar — `google-calendar.ts`, asked of Microsoft Graph.
 *
 * The same rules, because they are the product's rules rather than Google's:
 * the provider is the truth, a window either side of today is read and upserted
 * on the provider's own event id, a recurring series arrives expanded into its
 * occurrences, and an event the provider no longer has inside the window is
 * deleted rather than left on the Calendar to be planned around.
 *
 * It lands in `client_portal_calendar_events` beside Google's, which has carried
 * a `provider` column since client-portal/018 — so Outlook needed no migration
 * and `listPersonalEvents` in `google-calendar.ts` already returns both.
 *
 * `calendarView` rather than `events` is what expands a series: `/me/events`
 * returns the master with its recurrence rule, which is not something a
 * calendar can be drawn from.
 *
 * Read-only, as Google's is. The portal's Calendar schedules nothing, so the
 * consent asks for `Calendars.Read` and never `ReadWrite`.
 */

const API = "https://graph.microsoft.com/v1.0/me";
/** How far either side of today a sync reads — Google's window exactly. */
const PAST_DAYS = 60;
const FUTURE_DAYS = 365;
const STALE_AFTER_MS = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
/** One page is 250 as Google's is; the ceiling stops a runaway calendar. */
const PAGE = 250;
const MAX_EVENTS = 2500;

type GraphEvent = {
  id?: string;
  subject?: string;
  isCancelled?: boolean;
  isAllDay?: boolean;
  webLink?: string;
  location?: { displayName?: string };
  /** Graph sends a local wall time plus the zone it is in, not an instant. */
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  responseStatus?: { response?: string };
  attendees?: { emailAddress?: { name?: string; address?: string }; type?: string }[];
};

/**
 * Graph's `dateTime` is a wall time with no offset on it, and `timeZone` says
 * which zone to read it in — `UTC` when the request asked for that, which this
 * one does.
 *
 * An all-day event is the exception: Graph gives it midnight UTC, which is the
 * wrong instant everywhere east or west of it. Placed in the reader's own zone
 * instead, the way `google-calendar.ts` places a bare `date`.
 */
function instantOf(edge: GraphEvent["start"], allDay: boolean, timeZone: string) {
  const raw = edge?.dateTime;
  if (!raw) return null;

  if (allDay) {
    const [year, month, day] = raw.slice(0, 10).split("-").map(Number);
    if (!year || !month || !day) return null;
    return zonedTime(year, month, day, 0, 0, timeZone).toISOString();
  }

  // Graph omits the offset; the request pins the zone to UTC, so say so.
  const withZone = /(?:Z|[+-]\d\d:?\d\d)$/.test(raw) ? raw : `${raw}Z`;
  const at = new Date(withZone);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

function attendeeLine(event: GraphEvent) {
  const names = (event.attendees ?? [])
    .filter((person) => person.type !== "resource")
    .map((person) => person.emailAddress?.name || person.emailAddress?.address)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

export async function syncOutlookCalendar(
  contactId: string,
  timeZone: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "The server is missing its credentials." };

  const { data: integration } = await supabase
    .from("client_portal_integrations")
    .select("sync_settings")
    .eq("contact_id", contactId)
    .eq("provider", "outlook_calendar")
    .neq("status", "disconnected")
    .maybeSingle();

  if (!integration) return { ok: false, error: "Outlook Calendar is not connected." };

  const grant = await grantFor(contactId, "outlook_calendar");
  if (!grant) return { ok: false, error: "Outlook Calendar is not connected." };

  const showDeclined = settingOn(
    (integration.sync_settings as Record<string, boolean>) ?? {},
    "show_declined",
    "outlook_calendar",
  );

  const start = new Date(Date.now() - PAST_DAYS * DAY);
  const end = new Date(Date.now() + FUTURE_DAYS * DAY);

  const items: GraphEvent[] = [];
  let next: string | null =
    `${API}/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}` +
    `&$select=id,subject,isCancelled,isAllDay,webLink,location,start,end,responseStatus,attendees` +
    `&$orderby=start/dateTime&$top=${PAGE}`;

  // Paged, because a year of a busy calendar is more than one page.
  while (next && items.length < MAX_EVENTS) {
    const response: Response = await fetch(next, {
      headers: {
        Authorization: `Bearer ${grant.accessToken}`,
        // Every wall time comes back in one zone, so `instantOf` has one rule
        // rather than a zone database per event.
        Prefer: 'outlook.timezone="UTC"',
      },
      cache: "no-store",
    });

    if (!response.ok) {
      await markNeedsAttention(
        contactId,
        "outlook_calendar",
        "Outlook Calendar did not answer. Try connecting it again.",
      );
      return { ok: false, error: (await response.text()).slice(0, 200) };
    }

    const page = (await response.json()) as {
      value?: GraphEvent[];
      "@odata.nextLink"?: string;
    };
    items.push(...(page.value ?? []));
    next = page["@odata.nextLink"] ?? null;
  }

  const now = new Date().toISOString();

  const rows = items.flatMap((event) => {
    const allDay = event.isAllDay === true;
    const startAt = instantOf(event.start, allDay, timeZone);
    if (!event.id || event.isCancelled === true || !startAt) return [];

    const declined = event.responseStatus?.response === "declined";
    if (declined && !showDeclined) return [];

    return [
      {
        contact_id: contactId,
        provider: "outlook_calendar",
        external_event_id: event.id,
        title: event.subject?.trim() || "(No title)",
        start_at: startAt,
        end_at: instantOf(event.end, allDay, timeZone),
        all_day: allDay,
        location: event.location?.displayName?.trim() || null,
        attendees: attendeeLine(event),
        html_link: event.webLink ?? null,
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

  // Gone from Outlook — or now hidden as declined — is gone from the Calendar.
  const kept = new Set(rows.map((row) => row.external_event_id));
  const { data: stored } = await supabase
    .from("client_portal_calendar_events")
    .select("id, external_event_id")
    .eq("contact_id", contactId)
    .eq("provider", "outlook_calendar")
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString());

  const gone = (stored ?? [])
    .filter((row) => !kept.has(row.external_event_id as string))
    .map((row) => row.id as string);

  if (gone.length > 0) {
    await supabase.from("client_portal_calendar_events").delete().in("id", gone);
  }

  await markSynced(contactId, "outlook_calendar");
  return { ok: true, count: rows.length };
}

/** Sync, if the last one is old enough to be worth repeating. Never throws. */
export async function syncOutlookCalendarIfStale(contactId: string | null, timeZone: string) {
  if (!contactId) return;
  try {
    const supabase = createServiceClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("client_portal_integrations")
      .select("last_sync_at")
      .eq("contact_id", contactId)
      .eq("provider", "outlook_calendar")
      .eq("status", "connected")
      .maybeSingle();

    if (!data) return;
    const last = data.last_sync_at ? new Date(data.last_sync_at as string).getTime() : 0;
    if (Date.now() - last < STALE_AFTER_MS) return;

    await syncOutlookCalendar(contactId, timeZone);
  } catch {
    // A calendar that cannot be read must never take the Calendar down with it.
  }
}
