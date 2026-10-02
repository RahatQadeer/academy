import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { toClientRequestStatus } from "@/client-portal/lib/status";
import * as fixtures from "@/client-portal/lib/fixtures";
import type { PortalRequest } from "@/client-portal/types";

type RequestRow = {
  id: string;
  title: string;
  desired_outcome: string | null;
  status: string | null;
  /** whitbyos/010 — how pressing, and whether it is going well. */
  urgency: string | null;
  health: string | null;
  target_date: string | null;
  next_action: string | null;
  waiting_on: string | null;
  visibility: string | null;
  updated_at: string;
  closed_at: string | null;
  owner_user_id: string | null;
  /** Only selected when `WORK_SUMMARY_IS_SHAREABLE`; absent otherwise. */
  work_summary?: string | null;
};

/**
 * Whether a closed request's `work_summary` may be rendered to the client.
 *
 * False, deliberately. SRS 6.16.2 permits sharing an *approved* Work Summary,
 * and 6.16.4 lists "produce the Work Summary" and "produce a client-safe
 * summary if needed" as two separate steps of closeout. So the column is the
 * internal closing record until someone approves it for release.
 *
 * `whitbyos/migrations/005_request_work_summary.sql` adds `work_summary` and
 * `closed_by_user_id` and nothing else — there is no approved/shared flag to
 * gate on. Every other client-visible surface in this module keys on an
 * explicit one (`whitbyos_updates.status = 'published'`, `documents.visibility
 * = 'client_visible'`, `whitbyos_calendar.client_visible`), and inferring
 * "closed and non-null means shared" would put an unreviewed internal summary
 * in front of the client.
 *
 * Sabahat owns the flag. When it lands this becomes true and `selectFor` picks
 * the column up — see the open question in `client-portal/migrations/README.md`.
 */
export const WORK_SUMMARY_IS_SHAREABLE = false;

/**
 * `work_summary` is only in the select list when it is actually readable.
 * PostgREST 400s on an unknown column, and 005 is still a proposal in
 * `whitbyos/migrations/`, so naming it unconditionally would break every
 * request read on any environment where that file has not been applied.
 */
const REQUEST_COLUMNS =
  "id, title, desired_outcome, status, urgency, health, target_date, next_action, waiting_on, visibility, updated_at, closed_at, owner_user_id" +
  (WORK_SUMMARY_IS_SHAREABLE ? ", work_summary" : "");

/**
 * Requests the signed-in person is permitted to see.
 *
 * Three visibility values apply (SRS 13.14.14): `client_account` is visible to
 * every permitted member; `selected_people` and `private_to_requestor` require
 * an explicit participant row for this contact. We filter here as well as in RLS
 * so a policy gap can never widen what the portal renders.
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
export const listRequests = cache(async (): Promise<PortalRequest[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") return fixtures.REQUESTS;
  // The area gate, at the read boundary. RLS scopes these rows to the client
  // *account*; `permissions` decides which of the people on that account may
  // see them, and this is the one place every screen, count and preview of
  // a request passes through.
  if (!ctx.areas.requests) return [];

  const supabase = await createClient();

  const { data: participantRows } = await supabase
    .from("whitbyos_request_participants")
    .select("request_id")
    .eq("participant_type", "contact")
    .eq("participant_id", ctx.contactId!);

  const participantIds = new Set(
    (participantRows ?? []).map((row) => row.request_id as string),
  );

  const { data, error } = await supabase
    .from("whitbyos_requests")
    .select(REQUEST_COLUMNS)
    .eq("client_id", ctx.clientId!)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  // `unknown` first because REQUEST_COLUMNS is built at runtime: supabase-js
  // infers row shape from a *literal* select string and falls back to
  // GenericStringError[] when it cannot read one.
  const permitted = (data as unknown as RequestRow[]).filter(
    (row) => row.visibility === "client_account" || participantIds.has(row.id),
  );

  const progress = await requestProgress(permitted.map((row) => row.id));
  return permitted.map((row) => toPortalRequest(row, progress.get(row.id) ?? 0));
});

/**
 * How far along each Request is, as a percentage of its client-visible Tasks.
 *
 * Whitby computes its own "Step 3 of 7" from the Work Plan's Workstreams
 * (`getRequestDetail` in `whitbyos/lib/request-detail.ts`), but a Work Plan is
 * internal — SRS 13.11 keeps Workstreams, considerations and internal Tasks off
 * the client's view entirely, and the portal does not read that table. Counting
 * the Tasks the client can actually see gives a number that matches the Tasks
 * tab beside it, which is the only number the client can check.
 *
 * So this is deliberately not the same figure as the professional's. It is the
 * honest one for this side: a request with no client-visible tasks reports 0
 * rather than borrowing a percentage from work the client is never shown.
 */
async function requestProgress(requestIds: string[]): Promise<Map<string, number>> {
  const progress = new Map<string, number>();
  if (requestIds.length === 0) return progress;

  const supabase = await createClient();
  const { data } = await supabase
    .from("whitbyos_tasks")
    .select("request_id, status")
    .in("request_id", requestIds)
    .eq("visibility", "client_visible");

  const counts = new Map<string, { total: number; done: number }>();
  for (const row of data ?? []) {
    const id = row.request_id as string;
    const entry = counts.get(id) ?? { total: 0, done: 0 };
    entry.total += 1;
    // The same three words `toTaskStatus` treats as finished in data/tasks.ts.
    if (DONE.has(((row.status as string) ?? "").toLowerCase())) entry.done += 1;
    counts.set(id, entry);
  }

  for (const [id, entry] of counts) {
    progress.set(id, Math.round((entry.done / entry.total) * 100));
  }
  return progress;
}

const DONE = new Set(["completed", "complete", "done"]);

export async function getRequest(id: string): Promise<PortalRequest | null> {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") {
    return fixtures.REQUESTS.find((request) => request.id === id) ?? null;
  }

  // Go through listRequests so the visibility filter is applied in exactly one
  // place — a direct .eq("id") read here would bypass it.
  const permitted = await listRequests();
  return permitted.find((request) => request.id === id) ?? null;
}

function toPortalRequest(row: RequestRow, progress: number): PortalRequest {
  const status = toClientRequestStatus(row.status, row.closed_at);
  return {
    id: row.id,
    title: row.title,
    description: row.desired_outcome,
    status,
    urgency: row.urgency,
    // A closed request is not "at risk" whatever the column still says — health
    // describes work in flight, and Whitby has no reason to reset it on close.
    health: status === "completed" ? null : row.health,
    targetDate: row.target_date,
    nextStep: row.next_action,
    waitingOn: row.waiting_on,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    // Closed means finished, whatever the task count says: a request can be
    // closed with tasks left open, and telling the client it is 60% done after
    // their attaché has closed it would be wrong on the face of it.
    progress: status === "completed" ? 100 : progress,
    ownerName: null,
    workSummary: WORK_SUMMARY_IS_SHAREABLE ? (row.work_summary ?? null) : null,
  };
}
