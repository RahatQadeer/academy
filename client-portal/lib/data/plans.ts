import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import * as fixtures from "@/client-portal/lib/fixtures";
import type { PortalPlan, PortalPlanStream, PortalPlanTask } from "@/client-portal/types";

/**
 * The Work Plans the professional has shared on one Request.
 *
 * SRS 13.11.2 keeps the internal Workplan off this side, so nothing here reads
 * `whitbyos_workplans` or `whitbyos_workstreams` directly — the portal has no
 * policy on either and should never be given one. The plan arrives through
 * `portal_request_plans()`, which returns a plan only once a professional has
 * ticked "Share this Work Plan with the client" on WP.17v, and only for a
 * Request `portal_can_see_request()` already lets this reader open.
 *
 * What a shared plan carries is decided in that function (client-portal/014):
 * every task in every visible stream, with status, dates, kind and owner's
 * name — and none of priority, next action, checklist, dependency or what a
 * task is waiting on.
 *
 * Read defensively in both directions. Before 013 the function does not exist
 * and PostgREST answers PGRST202, which is "nothing shared" — true, since
 * nothing could have been. Between 013 and 014 it returns the older, thinner
 * shape, and every field 014 added falls back to empty here.
 *
 * `cache()`d per request and keyed on the Request, as every other list in this
 * folder is. The top bar names a plan screen from the plan's own name, so on
 * those two addresses this function is asked for the same rows twice — once by
 * the bar and once by the screen under it — and the RPC should run once.
 */
export const listRequestPlans = cache(async (requestId: string): Promise<PortalPlan[]> => {
  const ctx = await getPortalContext();
  if (ctx.mode === "demo") {
    return fixtures.PLANS.filter((plan) => plan.requestId === requestId);
  }
  // A plan is a view onto the work on a Request, so it follows the same area.
  if (!ctx.areas.requests) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_request_plans", {
    p_request_id: requestId,
  });

  if (error || !Array.isArray(data)) return [];
  return (data as unknown[]).map((row) => toPortalPlan(row, requestId));
});

/** One shared plan on one Request, or null — its own screen's read. */
export async function getRequestPlan(
  requestId: string,
  planId: string,
): Promise<PortalPlan | null> {
  const plans = await listRequestPlans(requestId);
  return plans.find((plan) => plan.id === planId) ?? null;
}

type Json = Record<string, unknown>;

const KINDS = new Set(["auto", "approval", "manual"]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function kind(value: unknown): "auto" | "approval" | "manual" {
  return typeof value === "string" && KINDS.has(value)
    ? (value as "auto" | "approval" | "manual")
    : "manual";
}

function list(value: unknown): Json[] {
  return Array.isArray(value) ? (value as Json[]) : [];
}

function toPortalPlan(raw: unknown, requestId: string): PortalPlan {
  const row = (raw ?? {}) as Json;
  return {
    id: String(row.id),
    requestId,
    name: text(row.name) ?? "Work Plan",
    desiredOutcome: text(row.desiredOutcome),
    status: text(row.status) ?? "active",
    urgency: text(row.urgency),
    health: text(row.health),
    startDate: text(row.startDate),
    targetDate: text(row.targetDate),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt) ?? new Date(0).toISOString(),
    sharedAt: text(row.sharedAt),
    ownerName: text(row.ownerName),
    streams: list(row.streams).map(toPortalStream),
  };
}

function toPortalStream(row: Json): PortalPlanStream {
  return {
    id: String(row.id),
    name: text(row.name) ?? "Work Stream",
    purpose: text(row.purpose),
    status: text(row.status) ?? "not_started",
    kind: kind(row.kind),
    blocked: row.blocked === true,
    targetDate: text(row.targetDate),
    createdAt: text(row.createdAt),
    ownerName: text(row.ownerName),
    tasks: list(row.tasks).map(toPortalPlanTask),
  };
}

function toPortalPlanTask(row: Json): PortalPlanTask {
  return {
    id: String(row.id),
    title: text(row.title) ?? "Task",
    status: text(row.status) ?? "not_started",
    kind: kind(row.kind),
    dueAt: text(row.dueAt),
    completedAt: text(row.completedAt),
    createdAt: text(row.createdAt),
    waiting: row.waiting === true,
    ownerName: text(row.ownerName),
  };
}
