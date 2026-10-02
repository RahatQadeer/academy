import { createServiceClient } from "@/base/lib/supabase/service";
import { siteUrl } from "@/base/auth/site";
import { zonedTime } from "@/whitbyos/lib/zoned";

/**
 * Google Calendar, for real — SRS §11.1 and §11.2.
 *
 * §11.2 makes the connected calendar authoritative, and that is the whole
 * shape of this file. Google is read into `whitbyos_calendar_events` so the
 * rest of Whitby — Insights' calendar conflicts, a Request's dates, what the
 * client sees in the portal — can join against a calendar it can query. But
 * nothing here treats the local row as the truth: every sync overwrites the
 * event's own fields from Google, and every edit is sent to Google first.
 *
 * What stays local is only what Google has no idea about: which Request the
 * event belongs to, which Client that makes it, whether it is a Key Date, and
 * whether the client may see it. A sync never touches those four columns.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

/**
 * `calendar.events` covers reading and writing events on the calendars the
 * person already has. Not `calendar`, which also lets us create and delete
 * whole calendars — Whitby never does, and asking for it would make the
 * consent screen claim more than the product does.
 */
export const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export const GOOGLE_PROVIDER = "google_calendar";

/** Where the consent round-trip keeps its state, so a forged callback is refused. */
export const GOOGLE_OAUTH_COOKIE = "pa_google_calendar_oauth";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri() {
  return `${siteUrl()}/api/whitbyos/integrations/google/callback`;
}

/** Where Connect sends the professional. */
export function googleConsentUrl(state: string) {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES);
  // Offline plus a forced prompt, or Google withholds the refresh token on
  // every grant after the first and the connection dies in an hour.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });

  return (await response.json()) as TokenResponse;
}

/** The email on an id_token, without pulling in a JWT library to read a claim. */
function emailFromIdToken(idToken: string | undefined) {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

export type ConnectResult =
  | { ok: true; email: string | null }
  | { ok: false; error: string };

/** The callback's half of the exchange: code in, stored grant out. */
export async function completeGoogleConnection(
  workspaceId: string,
  code: string,
): Promise<ConnectResult> {
  if (!googleConfigured()) return { ok: false, error: "Google is not configured on this deployment." };

  const supabase = createServiceClient();
  if (!supabase) return { ok: false, error: "Server credentials are missing." };

  const token = await postToken({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });

  if (!token.access_token) {
    return { ok: false, error: token.error_description || token.error || "Google refused the connection." };
  }

  const email = emailFromIdToken(token.id_token);
  const expiresAt = new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString();

  const { error: credentialError } = await supabase
    .from("whitbyos_integration_credentials")
    .upsert(
      {
        workspace_id: workspaceId,
        provider: GOOGLE_PROVIDER,
        account_email: email,
        // "primary" is the signed-in account's own calendar. Google accepts it
        // as an id everywhere a calendar id is wanted.
        calendar_id: "primary",
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        expires_at: expiresAt,
        scope: token.scope ?? GOOGLE_CALENDAR_SCOPES,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider" },
    );

  if (credentialError) return { ok: false, error: credentialError.message };

  const { error: integrationError } = await supabase
    .from("whitbyos_integrations")
    .upsert(
      {
        workspace_id: workspaceId,
        provider: GOOGLE_PROVIDER,
        status: "connected",
        connected_account: email,
        scopes: token.scope ?? GOOGLE_CALENDAR_SCOPES,
        error_state: null,
      },
      { onConflict: "workspace_id,provider" },
    );

  if (integrationError) return { ok: false, error: integrationError.message };

  return { ok: true, email };
}

type Grant = {
  accessToken: string;
  calendarId: string;
  accountEmail: string | null;
};

/**
 * A usable access token, refreshed if it is within a minute of expiring.
 *
 * A refresh that Google rejects — the grant revoked from the Google account
 * side, most often — is not a transient failure, so the integration is marked
 * `needs_attention` rather than retried silently. §11.1.7 has that state, and
 * Screen 16 draws it.
 */
async function grantFor(workspaceId: string): Promise<Grant | null> {
  if (!googleConfigured()) return null;

  const supabase = createServiceClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("whitbyos_integration_credentials")
    .select("access_token, refresh_token, expires_at, calendar_id, account_email")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();

  if (!data) return null;

  const calendarId = (data.calendar_id as string) || "primary";
  const accountEmail = (data.account_email as string | null) ?? null;
  const expiresAt = data.expires_at ? new Date(data.expires_at as string).getTime() : 0;

  if (data.access_token && expiresAt > Date.now() + 60_000) {
    return { accessToken: data.access_token as string, calendarId, accountEmail };
  }

  if (!data.refresh_token) return null;

  const token = await postToken({
    refresh_token: data.refresh_token as string,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
  });

  if (!token.access_token) {
    await supabase
      .from("whitbyos_integrations")
      .update({
        status: "needs_attention",
        error_state: token.error_description || "Google needs you to sign in again.",
      })
      .eq("workspace_id", workspaceId)
      .eq("provider", GOOGLE_PROVIDER);
    return null;
  }

  await supabase
    .from("whitbyos_integration_credentials")
    .update({
      access_token: token.access_token,
      expires_at: new Date(Date.now() + (token.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER);

  return { accessToken: token.access_token, calendarId, accountEmail };
}

type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string }[];
};

function attendeeLine(event: GoogleEvent) {
  const names = (event.attendees ?? [])
    .map((person) => person.displayName || person.email)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

/**
 * An all-day event arrives as a bare date rather than a timestamp. Treated as
 * midnight-to-midnight in the reader's own zone, which is what the row can
 * hold and what "All day" on the screen then means.
 */
function instantOf(
  edge: { dateTime?: string; date?: string } | undefined,
  timeZone: string,
) {
  if (!edge) return null;
  if (edge.dateTime) return new Date(edge.dateTime).toISOString();

  if (edge.date) {
    const [year, month, day] = edge.date.split("-").map(Number);
    // Midnight where the workspace is, not where the server happens to run —
    // otherwise a whole-day event in New York starts at 8pm the day before.
    return zonedTime(year, month, day, 0, 0, timeZone).toISOString();
  }

  return null;
}

export type SyncOutcome = { ok: boolean; error?: string; count?: number };

/**
 * Pull one window of Google's calendar into the table.
 *
 * `singleEvents` expands a recurring series into its occurrences, which is
 * what a week of a calendar means to the person reading it — the alternative
 * is one row for "every Tuesday" that appears on no Tuesday in particular.
 *
 * Events Google no longer has in the window are deleted locally rather than
 * left behind: a cancelled appointment that stays on the screen is worse than
 * one that never arrived, because it is still being planned around.
 */
export async function syncGoogleWindow(
  workspaceId: string,
  start: Date,
  end: Date,
  timeZone: string,
): Promise<SyncOutcome> {
  const grant = await grantFor(workspaceId);
  if (!grant) return { ok: false };

  const supabase = createServiceClient();
  if (!supabase) return { ok: false };

  const url = new URL(`${API}/calendars/${encodeURIComponent(grant.calendarId)}/events`);
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${grant.accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    await supabase
      .from("whitbyos_integrations")
      .update({ status: "needs_attention", error_state: "Google Calendar did not answer." })
      .eq("workspace_id", workspaceId)
      .eq("provider", GOOGLE_PROVIDER);
    return { ok: false, error: detail.slice(0, 200) };
  }

  const payload = (await response.json()) as { items?: GoogleEvent[] };
  const items = (payload.items ?? []).filter(
    (event) => event.id && event.status !== "cancelled" && instantOf(event.start, timeZone),
  );

  const rows = items.map((event) => ({
    workspace_id: workspaceId,
    external_calendar: GOOGLE_PROVIDER,
    external_event_id: event.id as string,
    title: event.summary?.trim() || "(No title)",
    start_at: instantOf(event.start, timeZone),
    end_at: instantOf(event.end, timeZone),
    location: event.location ?? null,
    attendees: attendeeLine(event),
  }));

  if (rows.length > 0) {
    // Only the columns Google owns are sent, so `kind`, `client_visible` and
    // the two link columns survive every sync untouched.
    const { error } = await supabase
      .from("whitbyos_calendar_events")
      .upsert(rows, { onConflict: "workspace_id,external_calendar,external_event_id" });

    if (error) return { ok: false, error: error.message };
  }

  const seen = new Set(rows.map((row) => row.external_event_id));
  const { data: stored } = await supabase
    .from("whitbyos_calendar_events")
    .select("id, external_event_id")
    .eq("workspace_id", workspaceId)
    .eq("external_calendar", GOOGLE_PROVIDER)
    .gte("start_at", start.toISOString())
    .lt("start_at", end.toISOString());

  const gone = (stored ?? [])
    .filter((row) => row.external_event_id && !seen.has(row.external_event_id as string))
    .map((row) => row.id as string);

  if (gone.length > 0) {
    await supabase.from("whitbyos_calendar_events").delete().in("id", gone);
  }

  await supabase
    .from("whitbyos_integrations")
    .update({ status: "connected", last_sync_at: new Date().toISOString(), error_state: null })
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER);

  return { ok: true, count: rows.length };
}

export type PushedEvent = { externalEventId: string; htmlLink: string | null };

/** Screen 8c's "Save To — Google Calendar". Google issues the id; Whitby mirrors it. */
export async function createGoogleEvent(
  workspaceId: string,
  event: {
    title: string;
    startAt: Date;
    endAt: Date;
    attendees: string | null;
    location: string | null;
    timeZone: string;
  },
): Promise<PushedEvent | null> {
  const grant = await grantFor(workspaceId);
  if (!grant) return null;

  const response = await fetch(
    `${API}/calendars/${encodeURIComponent(grant.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${grant.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        location: event.location || undefined,
        start: { dateTime: event.startAt.toISOString(), timeZone: event.timeZone },
        end: { dateTime: event.endAt.toISOString(), timeZone: event.timeZone },
        attendees: emailsIn(event.attendees).map((email) => ({ email })),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) return null;

  const created = (await response.json()) as GoogleEvent;
  if (!created.id) return null;

  return { externalEventId: created.id, htmlLink: created.htmlLink ?? null };
}

/** Screen 8.1's "Save Changes", for an event Google owns. */
export async function updateGoogleEvent(
  workspaceId: string,
  externalEventId: string,
  patch: {
    title?: string;
    attendees?: string | null;
    location?: string | null;
  },
): Promise<boolean> {
  const grant = await grantFor(workspaceId);
  if (!grant) return false;

  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.summary = patch.title;
  if (patch.location !== undefined) body.location = patch.location || "";
  if (patch.attendees !== undefined) {
    const emails = emailsIn(patch.attendees);
    if (emails.length > 0) body.attendees = emails.map((email) => ({ email }));
  }

  const response = await fetch(
    `${API}/calendars/${encodeURIComponent(grant.calendarId)}/events/${encodeURIComponent(externalEventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${grant.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  return response.ok;
}

/**
 * Attendees are stored as the line the Figma shows — "Jordan Hartwell,
 * Alexandra Hartwell" — because most people on a family-office appointment
 * are not records in this system, let alone mailbox addresses. Only the ones
 * that are addresses are sent on to Google, which cannot invite a name.
 */
function emailsIn(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part));
}

/**
 * "Open in Google Calendar ↗".
 *
 * Google's own deep link is base64 of "<event id> <calendar id>", which is why
 * it is built rather than stored — it needs no column, and stays correct if
 * the connected account changes.
 */
export function googleEventUrl(externalEventId: string, accountEmail: string | null) {
  const calendarId = accountEmail || "primary";
  const eid = Buffer.from(`${externalEventId} ${calendarId}`, "utf8")
    .toString("base64")
    .replace(/=+$/, "");
  return `https://www.google.com/calendar/event?eid=${eid}`;
}

/**
 * Screen 16.2's Disconnect, on Google's side as well as ours.
 *
 * The stored grant is deleted and the refresh token handed back to Google to
 * revoke. Marking the integration disconnected while keeping a live token that
 * still reads someone's calendar would make the word on the screen untrue.
 */
export async function revokeGoogleGrant(workspaceId: string) {
  const supabase = createServiceClient();
  if (!supabase) return;

  const { data } = await supabase
    .from("whitbyos_integration_credentials")
    .select("refresh_token, access_token")
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER)
    .maybeSingle();

  const token = (data?.refresh_token as string | null) || (data?.access_token as string | null);

  if (token) {
    // Best effort: a grant the person already revoked from their Google
    // account answers 400, and that is the state we wanted anyway.
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      cache: "no-store",
    }).catch(() => undefined);
  }

  await supabase
    .from("whitbyos_integration_credentials")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("provider", GOOGLE_PROVIDER);
}
