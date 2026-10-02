import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

/** `whitbyos_consideration_type`, and what screen 14 calls each one. */
export const CONSIDERATION_TYPES: Record<string, string> = {
  missing_info: "Missing Info",
  dependency_conflict: "Dependency Conflict",
  stale_info: "Stale Info",
  risk_backup_gap: "Risk / Backup",
  calendar_conflict: "Calendar Conflict",
  requirement_prompt: "Requirement",
  next_action: "Next Action",
};

/**
 * The colour each kind wears, wherever it is drawn.
 *
 * The tiles at the top of Insights have been colour-coded since they were
 * built — stale amber, risk red, calendar green — and the rows underneath
 * them were grey text saying the same words. A reader scanning eighty-nine
 * of them had to read every one to find the three that were risks.
 *
 * One map, so the tile and the row can never drift apart.
 */
export const CONSIDERATION_TONES: Record<string, { bg: string; fg: string }> = {
  missing_info: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  stale_info: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  risk_backup_gap: { bg: "var(--danger-bg)", fg: "var(--danger-action-fg)" },
  calendar_conflict: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  dependency_conflict: { bg: "var(--module-portal-bg)", fg: "var(--module-portal-fg)" },
  requirement_prompt: { bg: "var(--module-academy-bg)", fg: "var(--module-academy-fg)" },
  next_action: { bg: "var(--accent-tint)", fg: "var(--accent)" },
};

export function typeTone(value: string | null) {
  return (
    CONSIDERATION_TONES[value ?? ""] ?? {
      bg: "var(--surface-active)",
      fg: "var(--text-secondary)",
    }
  );
}

export function typeLabel(value: string | null) {
  return CONSIDERATION_TYPES[value ?? ""] ?? "Consideration";
}

export type Consideration = {
  id: string;
  body: string;
  type: string;
  status: string;
  requestTitle: string | null;
  requestId: string | null;
  /** The plan that raised it — the list is grouped by this. */
  planId: string;
  planName: string;
  streamName: string | null;
  sourceReference: string | null;
  createdAt: string;
  taskId: string | null;
};

export type InsightsResult =
  | {
      ok: true;
      rows: Consideration[];
      counts: { open: number; stale: number; risk: number; calendar: number; requests: number };
    }
  | { ok: false; error: string };

/**
 * Screen 14 — Insights.
 *
 * A consideration hangs off a Work Plan or a Work Stream, neither of which
 * carries a workspace; the Request above them does. So reach is worked out the
 * same way Documents and Updates do it — from the Requests this workspace owns.
 *
 * The four stat cards count the rows they are about rather than being stored,
 * so a card can never disagree with the list under it.
 */
/**
 * `scoped` false is the one caller that wants the whole firm — Workspace
 * Overview, which is the screen the open client is chosen on and so cannot be
 * narrowed by it. Everything else gets the client whose workspace is open.
 */
export async function listConsiderations(
  { scoped = true }: { scoped?: boolean } = {},
): Promise<InsightsResult> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return { ok: true, rows: [], counts: { open: 0, stale: 0, risk: 0, calendar: 0, requests: 0 } };
  }

  const supabase = await createClient();

  /*
   * A consideration hangs off a Work Plan or a Work Stream, neither of which
   * carries a client — the Request above them does. So the client filter goes
   * on the Requests, and everything below reaches only through those.
   */
  const openClient = scoped ? await getOpenClientId() : null;

  let requestQuery = supabase
    .from("whitbyos_requests")
    .select("id, title")
    .eq("workspace_id", workspaceId);

  if (openClient) requestQuery = requestQuery.eq("client_id", openClient);

  const { data: requests, error: requestError } = await requestQuery;

  if (requestError) return { ok: false, error: requestError.message };

  const requestTitles = new Map(
    (requests ?? []).map((row) => [row.id as string, row.title as string]),
  );

  if (requestTitles.size === 0) {
    return { ok: true, rows: [], counts: { open: 0, stale: 0, risk: 0, calendar: 0, requests: 0 } };
  }

  const { data: plans } = await supabase
    .from("whitbyos_workplans")
    .select("id, request_id, name")
    .in("request_id", [...requestTitles.keys()]);

  const planRequests = new Map(
    (plans ?? []).map((row) => [row.id as string, row.request_id as string]),
  );

  /* Which plan raised it, so eighty-nine of these can be read a plan at a
     time instead of as one undifferentiated list. */
  const planNames = new Map(
    (plans ?? []).map((row) => [row.id as string, (row.name as string) ?? "Work plan"]),
  );

  if (planRequests.size === 0) {
    return { ok: true, rows: [], counts: { open: 0, stale: 0, risk: 0, calendar: 0, requests: 0 } };
  }

  const { data, error } = await supabase
    .from("whitbyos_considerations")
    .select(
      "id, body, type, status, workplan_id, workstream_id, source_reference, created_at, converted_to_task_id",
    )
    .in("workplan_id", [...planRequests.keys()])
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const streamIds = [
    ...new Set((data ?? []).map((row) => row.workstream_id as string).filter(Boolean)),
  ];

  const streamNames = new Map<string, string>();
  if (streamIds.length > 0) {
    const { data: streams } = await supabase
      .from("whitbyos_workstreams")
      .select("id, name")
      .in("id", streamIds);

    for (const row of streams ?? []) {
      streamNames.set(row.id as string, row.name as string);
    }
  }

  const rows: Consideration[] = (data ?? []).map((row) => {
    const requestId = planRequests.get(row.workplan_id as string) ?? null;
    return {
      id: row.id as string,
      body: row.body as string,
      type: (row.type as string) ?? "missing_info",
      status: (row.status as string) ?? "open",
      requestId,
      requestTitle: requestId ? (requestTitles.get(requestId) ?? null) : null,
      planId: row.workplan_id as string,
      planName: planNames.get(row.workplan_id as string) ?? "Work plan",
      streamName: streamNames.get(row.workstream_id as string) ?? null,
      sourceReference: (row.source_reference as string | null) ?? null,
      createdAt: row.created_at as string,
      taskId: (row.converted_to_task_id as string | null) ?? null,
    };
  });

  const open = rows.filter((row) => row.status === "open");

  return {
    ok: true,
    rows: open,
    counts: {
      open: open.length,
      stale: open.filter((row) => row.type === "stale_info").length,
      risk: open.filter((row) => row.type === "risk_backup_gap").length,
      calendar: open.filter((row) => row.type === "calendar_conflict").length,
      requests: new Set(open.map((row) => row.requestId).filter(Boolean)).size,
    },
  };
}
