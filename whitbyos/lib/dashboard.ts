import { WIDGETS } from "@/whitbyos/lib/widget-vocab";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getWorkspaceLogoUrl } from "@/base/lib/logo";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import type { RequestListRow } from "@/whitbyos/lib/requests";
import { pendingAccessRequests } from "@/whitbyos/lib/search";
import { photosFor } from "@/whitbyos/lib/people-photos";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

const CLOSED = new Set(["complete", "completed", "closed", "cancelled"]);

export type Dashboard = {
  greeting: string;
  name: string;
  initials: string;
  activeRequests: number;
  waitingOnYou: number;
  completedThisMonth: number;
  requests: RequestListRow[];
  /**
   * Clients' asks to add someone, unanswered. Home names them on their own
   * because the card that used to lead to them went with the old dashboard.
   */
  accessRequests: {
    id: string;
    clientId: string;
    clientName: string;
    personName: string;
    photo: string | null;
  }[];
};

function firstOf<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * The hour where the person actually is, not where the server is.
 *
 * `users.timezone` is set at sign-up; without it the greeting would tell
 * someone in Singapore good morning at their dinner time.
 */
function greetingFor(timezone: string | null) {
  const zone = timezone || "UTC";
  let hour: number;

  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: zone,
      }).format(new Date()),
    );
  } catch {
    hour = new Date().getUTCHours();
  }

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Screen 1 — the Dashboard.
 *
 * Every number is counted at read time from the work itself, the same rule
 * §6.6.10 sets for progress: a figure stored on the side drifts out of step the
 * moment anything changes, and a dashboard that is quietly wrong is worse than
 * one that is slow.
 */
export async function getDashboard(): Promise<Dashboard> {
  const profile = await getSessionProfile();
  const displayName =
    profile?.user.preferred_name ||
    profile?.user.full_name?.split(" ")[0] ||
    "there";

  const empty: Dashboard = {
    greeting: greetingFor(profile?.user.timezone ?? null),
    name: displayName,
    initials: initialsOf(profile?.user.full_name || displayName),
    activeRequests: 0,
    waitingOnYou: 0,
    completedThisMonth: 0,
    requests: [],
    accessRequests: [],
  };

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return empty;

  const supabase = await createClient();

  /*
   * Home answers for the workspace somebody is standing in.
   *
   * Every count here — active Requests, Waiting on You, completed this month
   * — was firm-wide, sitting beside widgets that were correctly narrowed to
   * one client, so the top of the screen quietly contradicted the rest of
   * it. The access-request banner was worse than a wrong number: it names
   * another client and their contact, with a face, at the very top of Home.
   */
  const openClient = await getOpenClientId();

  let query = supabase
    .from("whitbyos_requests")
    .select(
      "id, title, status, target_date, updated_at, closed_at, client_id, client:whitbyos_clients!client_id (id, name)",
    )
    .eq("workspace_id", workspaceId);

  if (openClient) query = query.or(`client_id.eq.${openClient},client_id.is.null`);

  const { data } = await query.order("updated_at", { ascending: false });

  const all = data ?? [];

  const open = all.filter((row) => !CLOSED.has(String(row.status).toLowerCase()));

  // "Waiting on You" is what has stopped and needs a person: a Request in a
  // waiting state, or one whose plan holds an approval nobody has given yet
  // (§1.15). Counted per Request, so one showing both ways still counts once.
  const waitingIds = new Set(
    open
      .filter((row) => String(row.status).toLowerCase() === "waiting")
      .map((row) => row.id as string),
  );

  for (const id of await requestsAwaitingApproval(open.map((r) => r.id as string))) {
    waitingIds.add(id);
  }

  // A client's access request is waiting on this person in the same sense, and
  // the drill-in lists them, so the card has to count them or the two disagree.
  const access = await pendingAccessRequests();
  const accessClientIds = [...new Set(access.map((ask) => ask.clientId))];
  const { data: accessClients } = accessClientIds.length
    ? await supabase.from("whitbyos_clients").select("id, primary_contact_id").in("id", accessClientIds)
    : { data: [] as { id: string; primary_contact_id: string | null }[] };
  const contactByClient = new Map(
    (accessClients ?? []).map((row) => [row.id as string, (row.primary_contact_id as string | null) ?? ""]),
  );
  const accessPhotos = await photosFor(supabase, {
    userIds: [],
    contactIds: [...contactByClient.values()].filter(Boolean),
  });

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const completedThisMonth = all.filter((row) => {
    if (!CLOSED.has(String(row.status).toLowerCase())) return false;
    const closed = row.closed_at ? new Date(row.closed_at as string) : null;
    return closed !== null && closed >= monthStart;
  }).length;

  return {
    ...empty,
    activeRequests: open.length,
    waitingOnYou: waitingIds.size + access.length,
    completedThisMonth,
    accessRequests: access
      .filter((ask) => !openClient || ask.clientId === openClient)
      .map((ask) => ({
        id: ask.id,
        clientId: ask.clientId,
        clientName: ask.clientName,
        personName: ask.personName,
        photo: accessPhotos.get(contactByClient.get(ask.clientId) ?? "") ?? null,
      })),
    // The reference lists four. It is the dashboard, not the Requests screen —
    // "View all" is right there for the rest.
    requests: open.slice(0, 4).map((row) => {
      const client = firstOf(
        row.client as unknown as { id: string; name: string } | { id: string; name: string }[] | null,
      );
      return {
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        target_date: row.target_date as string | null,
        updated_at: row.updated_at as string,
        client_id: row.client_id as string,
        client_name: client?.name ?? "No client",
      };
    }),
  };
}

/** Requests whose plan still has an approval-kind Work Stream open. */
async function requestsAwaitingApproval(requestIds: string[]) {
  if (requestIds.length === 0) return [];

  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("whitbyos_workplans")
    .select("id, request_id")
    .in("request_id", requestIds);

  if (!plans || plans.length === 0) return [];

  const byPlan = new Map(plans.map((p) => [p.id as string, p.request_id as string]));

  const { data: streams } = await supabase
    .from("whitbyos_workstreams")
    .select("workplan_id, kind, status")
    .in("workplan_id", [...byPlan.keys()])
    .eq("kind", "approval");

  const waiting = new Set<string>();
  for (const stream of streams ?? []) {
    if (CLOSED.has(String(stream.status).toLowerCase())) continue;
    const requestId = byPlan.get(stream.workplan_id as string);
    if (requestId) waiting.add(requestId);
  }

  return [...waiting];
}


/** Which workspaces this person can switch between, with what is live in each. */
export async function listMyWorkspaces() {
  const profile = await getSessionProfile();
  const mine = profile?.workspaces ?? [];
  if (mine.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_requests")
    .select("workspace_id, status")
    .in(
      "workspace_id",
      mine.map((workspace) => workspace.id),
    );

  const active = new Map<string, number>();
  for (const row of data ?? []) {
    const status = (row.status as string) ?? "";
    if (["completed", "closed", "complete", "cancelled"].includes(status)) continue;
    const id = row.workspace_id as string;
    active.set(id, (active.get(id) ?? 0) + 1);
  }

  /*
   * The logo with the name.
   *
   * It lives in a private bucket, so what is stored is a path and what a
   * browser can use is a signed URL — the same helper the rail's masthead
   * calls, run once per organisation rather than per render.
   */
  const logos = await Promise.all(
    mine.map((workspace) => getWorkspaceLogoUrl(workspace.logo_url)),
  );

  return mine.map((workspace, index) => ({
    id: workspace.id,
    name: workspace.name,
    logo: logos[index] ?? null,
    activeRequests: active.get(workspace.id) ?? 0,
  }));
}

/**
 * Which widgets this person keeps.
 *
 * Only a choice is stored. Absent means whatever 1.3 draws the box as, which
 * is on for five of the seven and off for Team Activity and Providers.
 */
export async function getWidgetPrefs(): Promise<Record<string, boolean>> {
  const workspaceId = await getCurrentWorkspaceId();
  const profile = await getSessionProfile();

  const prefs: Record<string, boolean> = {};
  for (const widget of WIDGETS) prefs[widget.key] = widget.on;
  if (!workspaceId || !profile) return prefs;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_dashboard_widgets")
    .select("widget_key, enabled")
    .eq("user_id", profile.user.id)
    .eq("workspace_id", workspaceId);

  for (const row of data ?? []) {
    prefs[row.widget_key as string] = Boolean(row.enabled);
  }

  return prefs;
}
