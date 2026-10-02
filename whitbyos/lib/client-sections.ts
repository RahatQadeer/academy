import { createClient } from "@/base/lib/supabase/server";
import { DEFAULT_MAX_ADDITIONAL_MEMBERS } from "@/base/lib/portal-seats";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import type { ClientRequest } from "@/whitbyos/lib/client-detail";

/**
 * The parts of SRS §5.3.3 that the five Figma tabs don't cover: the Work
 * section's remaining objects, Preferences and Handling, Account, and the
 * History section's Notes and Communications.
 */

export type WorkCounts = {
  tasks: number;
  forms: number;
  messages: number;
  updates: number;
  calendar: number;
};

export type ClientPreferences = {
  communication?: string;
  privacy?: string;
  handling?: string;
  importantDates?: string;
};

export type PortalCeiling = {
  anyPortalAccess: boolean;
  maxAdditionalMembers: number | null;
  maxAuthorizedUsers: number | null;
  membersWithAccess: number;
  /** Held per role, so a limit can be read against what is already there. */
  additionalMembers: number;
  authorizedUsers: number;
};

export type HistoryEntry = {
  id: string;
  kind: "note" | "communication";
  body: string;
  detail: string | null;
  created_at: string;
};

/**
 * §5.3.3's Work section. Tasks and Notes hang off Requests rather than the
 * Client, so they are counted through the client's requests.
 */
export async function getWorkCounts(
  clientId: string,
  requests: ClientRequest[],
): Promise<WorkCounts> {
  const supabase = await createClient();
  const requestIds = requests.map((request) => request.id);

  const countOf = async (
    table: string,
    column: string,
    values: string[] | string,
  ) => {
    if (Array.isArray(values) && values.length === 0) return 0;
    const query = supabase.from(table).select("id", { count: "exact", head: true });
    const { count } = await (Array.isArray(values)
      ? query.in(column, values)
      : query.eq(column, values));
    return count ?? 0;
  };

  const [tasks, forms, messages, updates, calendar] = await Promise.all([
    countOf("whitbyos_tasks", "request_id", requestIds),
    countOf("whitbyos_form_submissions", "client_id", clientId),
    countOf("whitbyos_messages", "client_id", clientId),
    countOf("whitbyos_updates", "client_id", clientId),
    countOf("whitbyos_calendar_events", "linked_client_id", clientId),
  ]);

  return { tasks, forms, messages, updates, calendar };
}

export type OverviewStats = {
  requests: number;
  requestsDueThisWeek: number;
  workPlans: number;
  workPlansActive: number;
  documents: number;
  documentsToday: number;
  messages: number;
  messagesUnread: number;
};

export type WeekItem = {
  id: string;
  label: string;
  when: string;
  kind: "Request" | "Event";
  href: string;
};

export type ClientMonthRow = {
  label: string;
  opened: number;
  closed: number;
};

const CLOSED_REQUEST = new Set(["complete", "completed", "closed", "cancelled"]);

/**
 * Last twelve months of this client's request activity, for the Overview chart.
 *
 * Opened = created that month. Closed = moved into a finished status that month
 * (best signal we have is `updated_at` while the row is already closed).
 */
export function clientRequestTrend(requests: ClientRequest[]): ClientMonthRow[] {
  const months: { key: string; label: string }[] = [];
  const cursor = new Date();
  cursor.setDate(1);

  for (let back = 11; back >= 0; back -= 1) {
    const month = new Date(cursor);
    month.setMonth(month.getMonth() - back);
    months.push({
      key: `${month.getFullYear()}-${month.getMonth()}`,
      label: month.toLocaleDateString("en-GB", { month: "short" }),
    });
  }

  const opened = new Map(months.map((month) => [month.key, 0]));
  const closed = new Map(months.map((month) => [month.key, 0]));

  for (const request of requests) {
    const born = new Date(request.created_at);
    if (!Number.isNaN(born.getTime())) {
      const key = `${born.getFullYear()}-${born.getMonth()}`;
      if (opened.has(key)) opened.set(key, (opened.get(key) ?? 0) + 1);
    }

    if (CLOSED_REQUEST.has(request.status.toLowerCase())) {
      const done = new Date(request.updated_at);
      if (!Number.isNaN(done.getTime())) {
        const key = `${done.getFullYear()}-${done.getMonth()}`;
        if (closed.has(key)) closed.set(key, (closed.get(key) ?? 0) + 1);
      }
    }
  }

  return months.map((month) => ({
    label: month.label,
    opened: opened.get(month.key) ?? 0,
    closed: closed.get(month.key) ?? 0,
  }));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfWeek(from: Date) {
  const date = new Date(from);
  date.setDate(date.getDate() + 7);
  return date;
}

/**
 * Screen 2.1's four stat cards and This Week strip.
 *
 * Counts reuse the same tables the Work section already reads, so Overview and
 * Work cannot disagree about how much is on this client.
 */
export async function getOverviewStats(
  clientId: string,
  requests: ClientRequest[],
): Promise<OverviewStats> {
  const supabase = await createClient();
  const requestIds = requests.map((request) => request.id);
  const today = startOfToday();
  const weekEnd = endOfWeek(today);

  const dueThisWeek = requests.filter((request) => {
    if (!request.target_date) return false;
    const due = new Date(request.target_date);
    return due >= today && due < weekEnd;
  }).length;

  const countOf = async (
    table: string,
    column: string,
    values: string[] | string,
  ) => {
    if (Array.isArray(values) && values.length === 0) return 0;
    const query = supabase.from(table).select("id", { count: "exact", head: true });
    const { count } = await (Array.isArray(values)
      ? query.in(column, values)
      : query.eq(column, values));
    return count ?? 0;
  };

  const [workPlans, workPlansActive, documents, documentsToday, messages] = await Promise.all([
    countOf("whitbyos_workplans", "request_id", requestIds),
    requestIds.length
      ? supabase
          .from("whitbyos_workplans")
          .select("id", { count: "exact", head: true })
          .in("request_id", requestIds)
          .eq("status", "active")
          .then(({ count }) => count ?? 0)
      : 0,
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("context_type", ["client", "request"])
      .in("context_id", [clientId, ...requestIds])
      .then(({ count }) => count ?? 0),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("context_type", ["client", "request"])
      .in("context_id", [clientId, ...requestIds])
      .gte("created_at", today.toISOString())
      .then(({ count }) => count ?? 0),
    supabase
      .from("whitbyos_messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .then(({ count }) => count ?? 0),
  ]);

  return {
    requests: requests.length,
    requestsDueThisWeek: dueThisWeek,
    workPlans,
    workPlansActive,
    documents,
    documentsToday,
    messages,
    messagesUnread: 0,
  };
}

export async function listThisWeek(
  clientId: string,
  requests: ClientRequest[],
): Promise<WeekItem[]> {
  const supabase = await createClient();
  const today = startOfToday();
  const weekEnd = endOfWeek(today);

  const due = requests.flatMap((request) => {
    if (!request.target_date) return [];
    const when = new Date(request.target_date);
    if (when < today || when >= weekEnd) return [];
    return [
      {
        id: `request-${request.id}`,
        label: `${request.title} due`,
        when: request.target_date,
        kind: "Request" as const,
        href: `/whitbyos/requests/${request.id}`,
      },
    ];
  });

  const { data: events } = await supabase
    .from("whitbyos_calendar_events")
    .select("id, title, start_at")
    .eq("linked_client_id", clientId)
    .gte("start_at", today.toISOString())
    .lt("start_at", weekEnd.toISOString())
    .order("start_at");

  const calendar = (events ?? []).map((row) => ({
    id: `event-${row.id}`,
    label: row.title as string,
    when: (row.start_at as string) ?? "",
    kind: "Event" as const,
    href: "/whitbyos/calendar",
  }));

  return [...due, ...calendar].sort((a, b) => a.when.localeCompare(b.when));
}

/**
 * §5.3.4 — the ceiling on what this Client's portal account can ever do.
 *
 * The numbers are the workspace's, set by Private Attaché staff in Super Admin
 * and read here so the Account section can report them. They used to be set
 * per client, from a dialog on this section; supabase/00056 moved them to
 * `workspaces` and took the dialog away, so this is read-only now and the same
 * for every client in the workspace.
 *
 * The counts either side of them are still this client's own.
 */
export async function getPortalCeiling(clientId: string): Promise<PortalCeiling> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_client_members")
    .select("role, portal_access")
    .eq("client_id", clientId);

  const rows = data ?? [];
  const withAccess = rows.filter((row) => row.portal_access);

  const seats = await getWorkspaceSeatLimits();

  return {
    anyPortalAccess: withAccess.length > 0,
    maxAdditionalMembers: seats.maxAdditionalMembers,
    maxAuthorizedUsers: seats.maxAuthorizedUsers,
    membersWithAccess: withAccess.length,
    additionalMembers: rows.filter((row) => row.role === "additional_member").length,
    authorizedUsers: rows.filter((row) => row.role === "authorized_user").length,
  };
}

/**
 * The workspace's seat limits, for the workspace the reader is in.
 *
 * A professional may select their own `workspaces` row (`workspaces_select_member`,
 * 00003), so no definer function is needed on this side — unlike the portal,
 * which reaches the same two columns through `portal_workspace_seat_limits()`.
 *
 * Writing them is another matter: a trigger in 00056 refuses any change that
 * does not come from the service role, which is why nothing in Whitby offers
 * one. Falling back to the schema's own default keeps an environment without
 * 00056 reporting the entitlement rather than "No limit".
 */
export async function getWorkspaceSeatLimits(): Promise<{
  maxAdditionalMembers: number | null;
  maxAuthorizedUsers: number | null;
}> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return {
      maxAdditionalMembers: DEFAULT_MAX_ADDITIONAL_MEMBERS,
      maxAuthorizedUsers: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("max_additional_members, max_authorized_users")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    return {
      maxAdditionalMembers: DEFAULT_MAX_ADDITIONAL_MEMBERS,
      maxAuthorizedUsers: null,
    };
  }

  return {
    maxAdditionalMembers:
      typeof data.max_additional_members === "number"
        ? data.max_additional_members
        : DEFAULT_MAX_ADDITIONAL_MEMBERS,
    maxAuthorizedUsers: data.max_authorized_users ?? null,
  };
}

/**
 * §5.3.3's History section beyond the Timeline. Notes are Request-level
 * (§6.12), Communications are logged against the Client directly (§7.4.5).
 */
export async function listHistory(
  clientId: string,
  requests: ClientRequest[],
): Promise<HistoryEntry[]> {
  const supabase = await createClient();
  const titleByRequest = new Map(requests.map((r) => [r.id, r.title]));
  const requestIds = requests.map((r) => r.id);

  const [notes, communications] = await Promise.all([
    requestIds.length > 0
      ? supabase
          .from("whitbyos_notes")
          .select("id, body, type, request_id, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [] }),
    supabase
      .from("whitbyos_communications")
      // `created_at` is not a column on this table, and asking for it failed
      // the whole query — so a client's history has never shown a logged call,
      // meeting or message, only its notes. `occurred_at` is when it happened,
      // which is the one this list sorts by anyway.
      .select("id, summary, type, occurred_at")
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(25),
  ]);

  const entries: HistoryEntry[] = [
    ...((notes.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      kind: "note" as const,
      body: row.body as string,
      detail: titleByRequest.get(row.request_id as string) ?? null,
      created_at: row.created_at as string,
    })),
    ...((communications.data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      kind: "communication" as const,
      body: row.summary as string,
      detail: (row.type as string) ?? null,
      created_at: row.occurred_at as string,
    })),
  ];

  return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** §5.3.3 section 2 — reads the free-form preferences jsonb. */
export function readPreferences(value: unknown): ClientPreferences {
  if (!value || typeof value !== "object") return {};
  return value as ClientPreferences;
}
