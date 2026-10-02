"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { EVENT_KIND } from "@/whitbyos/lib/calendar-vocab";
import { workspaceTimezone } from "@/whitbyos/lib/calendar";
import {
  GOOGLE_PROVIDER,
  createGoogleEvent,
  updateGoogleEvent,
} from "@/whitbyos/lib/google-calendar";
import { isoDateIn, zonedTime } from "@/whitbyos/lib/zoned";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";
import { tellAttendees } from "@/whitbyos/lib/event-invites";

const LIST = "/whitbyos/calendar";
const ROUTE = "/[product]/[[...slug]]";

const KINDS = new Set(EVENT_KIND.map((kind) => kind.value as string));

/** The default length of an appointment nobody gave an end to. */
const DEFAULT_MINUTES = 45;

function safeBack(value: FormDataEntryValue | null) {
  const path = String(value ?? "").trim();
  return path.startsWith(LIST) ? path : LIST;
}

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

/**
 * The screen the professional should be looking at once an event exists.
 *
 * Returning them to the week they came from is only right when the event is in
 * it. Put something on a date three weeks out and that week is not the answer
 * — it is a calendar with nothing new on it and a toast claiming otherwise,
 * which reads as the event not having been created at all.
 */
function backOnDay(path: string, day: string) {
  const [route, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set("date", day);
  return `${route}?${params.toString()}`;
}

/**
 * Who an event is for: the Request's client when it has a Request — an event
 * on the work belongs to whoever the work is for — otherwise the client named
 * on the form, checked against this workspace.
 *
 * The second route is what lets an event reach a client without a Request.
 * Before it, `linked_client_id` was only ever copied from a Request, so an
 * appointment for a client that belonged to no one piece of work had no client
 * at all and the portal, which reads by `linked_client_id`, could never show it.
 */
async function clientFor(requestId: string, namedClientId: string, workspaceId: string) {
  if (requestId) return clientBehind(requestId, workspaceId);
  if (!namedClientId) return { ok: true as const, clientId: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_clients")
    .select("id")
    .eq("id", namedClientId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data ? { ok: true as const, clientId: data.id as string } : { ok: false as const };
}

/** The client_id a Request belongs to — an event on the work belongs to whoever it is for. */
async function clientBehind(requestId: string, workspaceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_requests")
    .select("id, client_id")
    .eq("id", requestId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return data ? { ok: true as const, clientId: (data.client_id as string) ?? null } : { ok: false as const };
}

async function isConnected(workspaceId: string, provider: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_integrations")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();

  return data?.status === "connected";
}

/**
 * Screen 8c — New Event.
 *
 * "Save To" decides where the event is actually born. Choose the connected
 * calendar and it is created in Google first, and only then mirrored here with
 * the id Google gave it — so the next sync recognises it rather than adding a
 * second copy, and §11.2's rule that the connected calendar is authoritative
 * holds from the event's first second rather than from its first sync.
 *
 * With nothing connected it is held in Whitby, and carries no external
 * calendar at all: claiming an event belongs to Google when Google has never
 * seen it would make the little blue dot on Screen 8 a lie.
 */
/** "Friday 25 September at 09:00", in the workspace's own clock. */
function whenInWords(at: Date, timezone: string) {
  const day = at.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  });

  const clock = at.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });

  return `${day} at ${clock}`;
}

export async function createEvent(formData: FormData) {
  await stopIfReadOnly();

  const back = safeBack(formData.get("back"));
  const fail: (message: string) => never = (message) =>
    redirect(withParam(withParam(back, "new", "1"), "error", message));

  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim() || "09:00";
  const kind = String(formData.get("kind") ?? "appointment").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const namedClientId = String(formData.get("client_id") ?? "").trim();
  const attendees = String(formData.get("attendees") ?? "").trim();
  const saveTo = String(formData.get("save_to") ?? "").trim();
  const clientVisible = String(formData.get("client_visible") ?? "") === "1";

  if (!title) fail("Give the event a title.");
  if (!date) fail("Choose a date.");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) fail("Create your workspace first.");

  const timezone = await workspaceTimezone(workspaceId);
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !clock) fail("That date and time don't look right.");

  const startAt = zonedTime(
    Number(day![1]),
    Number(day![2]),
    Number(day![3]),
    Number(clock![1]),
    Number(clock![2]),
    timezone,
  );
  if (Number.isNaN(startAt.getTime())) fail("That date and time don't look right.");
  const endAt = new Date(startAt.getTime() + DEFAULT_MINUTES * 60_000);

  const owner = await clientFor(requestId, namedClientId, workspaceId!);
  if (!owner.ok) fail("That request or client is not in this workspace.");
  const clientId = owner.clientId;

  let externalCalendar: string | null = null;
  let externalEventId: string | null = null;

  if (saveTo === GOOGLE_PROVIDER && (await isConnected(workspaceId!, GOOGLE_PROVIDER))) {
    const pushed = await createGoogleEvent(workspaceId!, {
      title,
      startAt,
      endAt,
      attendees: attendees || null,
      location: null,
      timeZone: timezone,
    });

    if (!pushed) fail("Google Calendar wouldn't take that event. Try again, or save it in Whitby.");
    externalCalendar = GOOGLE_PROVIDER;
    externalEventId = pushed!.externalEventId;
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase.from("whitbyos_calendar_events").insert({
    workspace_id: workspaceId,
    title,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    kind: KINDS.has(kind) ? kind : "appointment",
    attendees: attendees || null,
    linked_request_id: requestId || null,
    linked_client_id: clientId,
    // Written at creation now. New Event had no way to say this, so every
    // event was born internal and the portal saw none of them until somebody
    // reopened each one and ticked the box on 8.1.
    client_visible: clientVisible && Boolean(clientId),
    external_calendar: externalCalendar,
    external_event_id: externalEventId,
  })
    .select("id")
    .single();

  if (error) fail(error.message);

  /*
   * And everybody on it is told.
   *
   * A meeting that changes nothing for the people in it is a note to self.
   * Each attendee Whitby can put a name to gets the event in the conversation
   * with them about the work it belongs to — opened if there is one, started
   * if there is not — and a notice, in their portal or on their bell.
   */
  await tellAttendees({
    workspaceId: workspaceId!,
    attendees: attendees || null,
    title,
    when: whenInWords(startAt, timezone),
    requestId: requestId || null,
    clientId,
    eventId: (created?.id as string) ?? "",
  });

  revalidatePath(ROUTE, "page");
  redirect(withParam(backOnDay(back, isoDateIn(startAt, timezone)), "created", title));
}

/**
 * Screen 8.1's "Save Changes".
 *
 * What Google owns goes to Google first and is only written here if Google
 * took it, so the two cannot quietly diverge. What Google has no concept of —
 * which Request this belongs to, and whether it is a Key Date — is Whitby's
 * alone and is written either way.
 */
export async function saveEvent(formData: FormData) {
  await stopIfReadOnly();

  const back = safeBack(formData.get("back"));
  const eventId = String(formData.get("event_id") ?? "").trim();
  const fail: (message: string) => never = (message) =>
    redirect(withParam(withParam(back, "event", eventId), "error", message));

  if (!eventId) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(back);

  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const attendees = String(formData.get("attendees") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const namedClientId = String(formData.get("client_id") ?? "").trim();
  const clientVisible = String(formData.get("client_visible") ?? "") === "1";

  if (!title) fail("An event needs a title.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("whitbyos_calendar_events")
    .select("id, workspace_id, external_calendar, external_event_id, linked_request_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!existing || existing.workspace_id !== workspaceId) redirect(back);

  const owner = await clientFor(requestId, namedClientId, workspaceId!);
  if (!owner.ok) fail("That request or client is not in this workspace.");
  const clientId = owner.clientId;

  if (existing!.external_calendar === GOOGLE_PROVIDER && existing!.external_event_id) {
    const pushed = await updateGoogleEvent(
      workspaceId!,
      existing!.external_event_id as string,
      { title, attendees: attendees || null },
    );

    if (!pushed) fail("Google Calendar wouldn't take that change. Try again.");
  }

  const { error } = await supabase
    .from("whitbyos_calendar_events")
    .update({
      title,
      kind: KINDS.has(kind) ? kind : "appointment",
      attendees: attendees || null,
      linked_request_id: requestId || null,
      linked_client_id: clientId,
      // Google has no concept of this and a sync never touches it — §13.5.3
      // makes it Whitby's decision alone who outside the team sees an event.
      client_visible: clientVisible && Boolean(clientId),
    })
    .eq("id", eventId)
    .eq("workspace_id", workspaceId);

  if (error) fail(error.message);

  revalidatePath(ROUTE, "page");
  redirect(withParam(back, "saved", title));
}

/**
 * 8.1's "Unlink from Request" — the event stays, the tie to the work goes.
 *
 * The client stays too. Whose appointment it is does not change because it no
 * longer hangs off one Request, and clearing it would silently pull a shared
 * event out of that client's portal.
 */
export async function unlinkEvent(formData: FormData) {
  await stopIfReadOnly();

  const back = safeBack(formData.get("back"));
  const eventId = String(formData.get("event_id") ?? "").trim();
  if (!eventId) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(back);

  const supabase = await createClient();
  await supabase
    .from("whitbyos_calendar_events")
    .update({ linked_request_id: null })
    .eq("id", eventId)
    .eq("workspace_id", workspaceId);

  revalidatePath(ROUTE, "page");
  redirect(withParam(back, "event", eventId));
}
