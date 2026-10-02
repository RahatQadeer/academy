import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { listWorkspaceAccessRequests } from "@/whitbyos/lib/client-detail";
import { usesClientWorkspaces, isHiddenFirmClient } from "@/whitbyos/lib/client-workspace";
import { getNotificationPrefs } from "@/whitbyos/lib/settings";
import { relativeTime, statusLabel } from "@/whitbyos/lib/format";
import { requestStatusLabel } from "@/whitbyos/lib/request-status";
import { taskStatusLabel } from "@/whitbyos/lib/task-vocab";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

/** Case-insensitive match against the fields a list row actually shows. */
export function matchesSearch(
  query: string,
  fields: Array<string | null | undefined>,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}

export type SearchHit = {
  id: string;
  label: string;
  kind: "Client" | "Request" | "Task" | "Document";
  /** The second line 1.0a draws: "Client · Active", "Whitfield Estate · At risk". */
  detail: string;
  href: string;
};

function nestedName(
  value: { name?: string } | { name?: string }[] | null | undefined,
) {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.name?.trim() || null;
}

function nestedTitle(
  value: { title?: string } | { title?: string }[] | null | undefined,
) {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.title?.trim() || null;
}

/**
 * 1.0a — the Home search.
 *
 * The export names its own scope: "You can search Clients, Requests, Tasks and
 * Documents." So it is those four and not the whole product — §10.6's broader
 * global search is still unresolved, and this is the part the design has
 * actually specified.
 *
 * Four queries rather than one view: they live in different tables with
 * different owners, and a view over them would have to be kept in step with
 * every one of them.
 */
export async function search(term: string): Promise<SearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();
  const like = `%${q}%`;

  const showClients = await usesClientWorkspaces();

  /*
   * The palette answers within the workspace somebody is standing in.
   *
   * A keystroke here reached across the whole firm — other clients' requests,
   * their tasks, their documents, and the client records themselves — from
   * inside a workspace narrowed to one of them. It is the fastest way in the
   * product to see something that is not yours, which is why it is worth
   * being the strictest: with a client open, the client list is not offered
   * at all, because the only client to go to from here is the one you are in.
   */
  const openClient = await getOpenClientId();

  const scope = <T extends { or: (filter: string) => T }>(query: T) =>
    openClient ? query.or(`client_id.eq.${openClient},client_id.is.null`) : query;

  const [clients, requests, tasks, documents] = await Promise.all([
    showClients && !openClient
      ? supabase
          .from("whitbyos_clients")
          .select("id, name, status, preferences, primary_contact_id, client_type, classification")
          .eq("workspace_id", workspaceId)
          .ilike("name", like)
          .limit(8)
      : Promise.resolve({
          data: [] as {
            id: string;
            name: string;
            status: string;
            preferences?: unknown;
            primary_contact_id?: string | null;
            client_type?: string | null;
            classification?: string | null;
          }[],
        }),
    scope(
      supabase
        .from("whitbyos_requests")
        .select("id, title, status, client:whitbyos_clients!client_id (name)")
        .eq("workspace_id", workspaceId)
        .ilike("title", like),
    ).limit(4),
    scope(
      supabase
        .from("whitbyos_tasks")
        .select("id, title, status, request:whitbyos_requests!request_id (title)")
        .eq("workspace_id", workspaceId)
        .ilike("title", like),
    ).limit(4),
    searchDocuments(supabase, workspaceId, like, openClient),
  ]);

  return [
    ...(clients.data ?? [])
      .filter((row) => !isHiddenFirmClient(row))
      .slice(0, 4)
      .map((row) => ({
      id: row.id as string,
      label: row.name as string,
      kind: "Client" as const,
      detail: `Client · ${statusLabel((row.status as string) || "active")}`,
      href: `/whitbyos/clients/${row.id}`,
    })),
    ...(requests.data ?? []).map((row) => {
      const client = nestedName(
        row.client as { name?: string } | { name?: string }[] | null,
      );
      const state = requestStatusLabel(row.status as string);
      return {
        id: row.id as string,
        label: row.title as string,
        kind: "Request" as const,
        detail: showClients && client ? `${client} · ${state}` : state,
        href: `/whitbyos/requests/${row.id}`,
      };
    }),
    ...(tasks.data ?? []).map((row) => {
      const request = nestedTitle(
        row.request as { title?: string } | { title?: string }[] | null,
      );
      const state = taskStatusLabel((row.status as string) ?? "");
      return {
        id: row.id as string,
        label: row.title as string,
        kind: "Task" as const,
        detail: request ? `${request} · ${state}` : state,
        href: `/whitbyos/tasks?task=${row.id}`,
      };
    }),
    ...documents,
  ];
}

/**
 * Documents hang off a Client or a Request, not a workspace, so they are
 * matched by title and then kept only when that context is this workspace's.
 *
 * Both contexts: a file on the client used to vanish here because only Request
 * ids were treated as reachable.
 */
async function searchDocuments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  like: string,
  /** The open client, or null for All clients. Documents hang off a context. */
  openClient: string | null,
): Promise<SearchHit[]> {
  const [{ data: clients }, { data: requests }] = await Promise.all([
    openClient
      ? supabase.from("whitbyos_clients").select("id").eq("id", openClient)
      : supabase.from("whitbyos_clients").select("id").eq("workspace_id", workspaceId),
    openClient
      ? supabase
          .from("whitbyos_requests")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("client_id", openClient)
      : supabase.from("whitbyos_requests").select("id").eq("workspace_id", workspaceId),
  ]);

  const contextIds = [
    ...(clients ?? []).map((row) => row.id as string),
    ...(requests ?? []).map((row) => row.id as string),
  ];
  if (contextIds.length === 0) return [];

  const { data } = await supabase
    .from("documents")
    .select("id, title, updated_at")
    .in("context_type", ["client", "request"])
    .in("context_id", contextIds)
    .ilike("title", like)
    .limit(4);

  return (data ?? []).map((row) => {
    const when = relativeTime(row.updated_at as string | null);
    return {
      id: row.id as string,
      label: row.title as string,
      kind: "Document" as const,
      detail: when === "No date" ? "No date" : `Updated ${when}`,
      href: `/whitbyos/documents?doc=${row.id}`,
    };
  });
}

export type WaitingItem = {
  id: string;
  client: string;
  what: string;
  type: "Approval" | "Review" | "Access";
  since: string;
  href: string;
};

/**
 * Pending access requests, if this person wants to hear about them.
 *
 * 17.3 has always offered "Client requests new access" as a preference and
 * nothing anywhere read it, so turning it off changed nothing. It reads it
 * now: switched off, these stay off this list, and the client detail screen
 * still shows them where they belong.
 */
export async function pendingAccessRequests() {
  if (!(await usesClientWorkspaces())) return [];
  const prefs = await getNotificationPrefs();
  if (prefs["email:client_access_request"] === false) return [];

  return listWorkspaceAccessRequests();
}

/**
 * 1.0b — Waiting on You, the drill-in behind the Dashboard's stat card.
 *
 * The export describes it as "items across your Requests and Work Plans where
 * the next step is yours — an approval, a review, or a reply", which is what
 * the Dashboard was already counting. This lists the same set rather than
 * counting it a second way, and now also the access requests a client has
 * raised: those are the same kind of work, and the only place they could be
 * found before was inside the one client they happen to sit on.
 */
export async function listWaitingOnYou(): Promise<WaitingItem[]> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return [];

  const supabase = await createClient();

  /*
   * Only the open client's work, when a client's workspace is open.
   *
   * This screen prints a Client column, so inside one client's workspace it
   * read as a list of other clients by name — the plainest possible version
   * of the mistake, on the screen somebody opens to decide what to do next.
   * The client was already joined for that column; nothing filtered on it.
   *
   * Work with no client on it is the firm's own and stays: it is nobody's,
   * so there is nobody to keep it from.
   */
  const openClient = await getOpenClientId();

  let requestQuery = supabase
    .from("whitbyos_requests")
    .select(
      "id, title, status, updated_at, client_id, client:whitbyos_clients!client_id (id, name)",
    )
    .eq("workspace_id", workspaceId);

  if (openClient) {
    requestQuery = requestQuery.or(`client_id.eq.${openClient},client_id.is.null`);
  }

  const { data: requests } = await requestQuery;

  // No early return on an empty Requests list any more: an access request is
  // waiting on this person whether or not any Request exists.
  const byId = new Map((requests ?? []).map((row) => [row.id as string, row]));

  const { data: plans } = byId.size
    ? await supabase
        .from("whitbyos_workplans")
        .select("id, name, request_id")
        .in("request_id", [...byId.keys()])
    : { data: [] };

  const planToRequest = new Map((plans ?? []).map((p) => [p.id as string, p]));

  const { data: streams } = planToRequest.size
    ? await supabase
        .from("whitbyos_workstreams")
        .select("id, name, status, workplan_id, updated_at")
        .in("workplan_id", [...planToRequest.keys()])
        .eq("kind", "approval")
    : { data: [] };

  const clientName = (row: unknown) => {
    const client = (row as { client?: { name: string } | { name: string }[] }).client;
    const first = Array.isArray(client) ? client[0] : client;
    return first?.name ?? "No client";
  };

  const items: WaitingItem[] = [];

  for (const stream of streams ?? []) {
    if (["complete", "completed"].includes(String(stream.status).toLowerCase())) continue;
    const plan = planToRequest.get(stream.workplan_id as string);
    const request = plan ? byId.get(plan.request_id as string) : null;
    if (!request) continue;

    items.push({
      id: stream.id as string,
      client: clientName(request),
      what: `Approve ${stream.name} (${plan!.name})`,
      type: "Approval",
      since: sinceLabel(stream.updated_at as string),
      href: `/whitbyos/work-plans/${plan!.id}?stream=${stream.id}`,
    });
  }

  // A client asking for someone to be added is work waiting on the
  // professional in exactly the sense this screen means, and until now the
  // only way to find one was to open the client it happened to be on.
  for (const ask of await pendingAccessRequests()) {
    // Somebody else's client asking for somebody else's colleague is not
    // work waiting on you inside this workspace.
    if (openClient && ask.clientId !== openClient) continue;
    items.push({
      id: ask.id,
      client: ask.clientName,
      what: `Review access for ${ask.personName}`,
      type: "Access",
      since: sinceLabel(ask.createdAt),
      href: `/whitbyos/clients/${ask.clientId}/contacts?review=${ask.id}`,
    });
  }

  for (const request of requests ?? []) {
    if (String(request.status).toLowerCase() !== "waiting") continue;
    items.push({
      id: request.id as string,
      client: clientName(request),
      what: `Review ${request.title}`,
      type: "Review",
      since: sinceLabel(request.updated_at as string),
      href: `/whitbyos/requests/${request.id}`,
    });
  }

  return items;
}

/** The export writes this as whole days: "1 day", "2 days", "3 days". */
function sinceLabel(iso: string | null) {
  if (!iso) return "No date";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "No date";

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 1) return "Today";
  return `${days} day${days === 1 ? "" : "s"}`;
}
