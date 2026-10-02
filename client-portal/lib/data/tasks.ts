import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import type { PortalTask, TaskStatus } from "@/client-portal/types";

type TaskRow = {
  id: string;
  request_id: string | null;
  /** whitbyos/044 — a Task may now name a client directly, with no Request. */
  client_id: string | null;
  title: string;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  waiting_state: string | null;
  next_action: string | null;
  updated_at: string;
  /** whitbyos/037 — when it was finished, not when it was last touched. */
  completed_at: string | null;
  whitbyos_requests: { title: string } | null;
};

/**
 * Client-visible Tasks (SRS 7.1.5), by either of the two routes one can reach
 * this client by.
 *
 * Until whitbyos/044 there was only one: a Task belonged to a client through
 * its Request, so permitted Request ids were resolved first and Tasks filtered
 * against them. 16z's New Task modal now asks for a "Client / Workspace"
 * directly — its first option is "None" — precisely so a Task can be named to
 * a client and to no Request at all. Whitby's own list has a "General" view for
 * exactly those, and reading only the Request route would have hidden every
 * one of them from the person they were named for.
 *
 * `visibility = 'client_visible'` is repeated here as well as in
 * `client-portal/migrations/005`'s RLS policy, so a policy gap can never widen
 * what the portal renders (same reasoning `requests.ts` uses).
 *
 * Three readers now. The Tasks tab on a Request's detail view takes the ones
 * with that `request_id`; Home's Action Needed takes the ones waiting on the
 * client; and `/client-portal/tasks` takes the ones with no Request at all,
 * which until it existed were read by nothing — the Request screen drops them
 * for having no Request, and Action Needed is about what is owed rather than
 * what is in progress.
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
export const listTasks = cache(async (): Promise<PortalTask[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.TASKS;
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // a task passes through.
  if (!ctx.areas.requests) return [];

  const supabase = await createClient();

  const { data: requestRows } = await supabase
    .from("whitbyos_requests")
    .select("id")
    .eq("client_id", ctx.clientId!);

  const requestIds = (requestRows ?? []).map((row) => row.id as string);

  // No early return on an empty Request list any more — a client with no
  // Requests at all can still have Tasks named straight to their account.
  const routes = [`client_id.eq.${ctx.clientId!}`];
  if (requestIds.length > 0) routes.push(`request_id.in.(${requestIds.join(",")})`);

  const { data, error } = await supabase
    .from("whitbyos_tasks")
    .select(
      "id, request_id, client_id, title, status, priority, due_date, waiting_state, next_action, updated_at, completed_at, whitbyos_requests(title)",
    )
    .or(routes.join(","))
    .eq("visibility", "client_visible")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error || !data) return [];

  // A task named to this client can still carry a Request they cannot open —
  // the professional's New Task dialog used to file every task under its Work
  // Plan's Request, including ones left unlinked. `requestIds` is already
  // RLS-scoped to the Requests this person may see, so anything outside it is
  // treated as having no Request: it lands on `/client-portal/tasks` instead of
  // being dropped by every screen, and Home does not link to a Request that
  // would refuse them.
  const openable = new Set(requestIds);
  return (data as unknown as TaskRow[]).map((row) =>
    row.request_id && !openable.has(row.request_id)
      ? toPortalTask({ ...row, request_id: null, whitbyos_requests: null })
      : toPortalTask(row),
  );
});

export function filterTasksByRequest(tasks: PortalTask[], requestId: string) {
  return tasks.filter((task) => task.requestId === requestId);
}

export function filterTasksByStatus(tasks: PortalTask[], status: TaskStatus) {
  return tasks.filter((task) => task.status === status);
}

function toPortalTask(row: TaskRow): PortalTask {
  return {
    id: row.id,
    title: row.title,
    status: toTaskStatus(row.status),
    priority: row.priority,
    dueAt: row.due_date,
    waitingOn: row.waiting_state,
    nextAction: row.next_action,
    requestId: row.request_id,
    requestTitle: row.whitbyos_requests?.title ?? null,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

/** Also how a shared plan's tasks become Tasks-tab rows, so one task has one status. */
export function toTaskStatus(raw: string | null): TaskStatus {
  switch (raw) {
    case "completed":
    case "complete":
    case "done":
      return "completed";
    case "waiting":
    case "blocked":
    case "on_hold":
      return "waiting";
    default:
      return "open";
  }
}
