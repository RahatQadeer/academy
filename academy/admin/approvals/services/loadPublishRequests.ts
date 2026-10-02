import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  isAcademyProgramType,
  isAcademyPublishRequestStatus,
  type AcademyProgramStatus,
  type AcademyProgramType,
} from "@/academy/lib/domain";
import type { ApprovalQueueItem, ApprovalQueueResult, QueueStatusFilter } from "../../types";
import { QUEUE_LIMIT } from "../../types";
import { approvalStage } from "../utils/labels";

function dbStatusForFilter(filter: QueueStatusFilter): "pending" | "approved" | "rejected" {
  if (filter === "pending") return "pending";
  if (filter === "returned") return "rejected";
  return "approved";
}

type RequestRow = {
  id: string;
  program_id: string;
  submitted_by_user_id: string;
  status: string;
  created_at: string;
  published_at: string | null;
};

type ProgramRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
};

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);

function asProgramStatus(value: string): AcademyProgramStatus | null {
  return PROGRAM_STATUSES.has(value as AcademyProgramStatus) ? (value as AcademyProgramStatus) : null;
}

async function displayNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from("users")
    .select("id, preferred_name, full_name, email")
    .in("id", unique)
    .limit(unique.length);
  const names = new Map<string, string>();
  for (const row of (data ?? []) as {
    id: string;
    preferred_name: string | null;
    full_name: string | null;
    email: string | null;
  }[]) {
    const name = (row.preferred_name || row.full_name || "").trim();
    const email = (row.email || "").trim();
    if (name) names.set(row.id, name);
    else if (email) names.set(row.id, email);
  }
  return names;
}

export async function loadPublishRequests(
  filter: QueueStatusFilter,
): Promise<ApprovalQueueResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    let listQuery = supabase
      .from("academy_publish_requests")
      .select("id, program_id, submitted_by_user_id, status, created_at, published_at")
      .eq("status", dbStatusForFilter(filter))
      .order("created_at", { ascending: false })
      .limit(QUEUE_LIMIT + 1);
    if (filter === "ready") listQuery = listQuery.is("published_at", null);
    if (filter === "published") listQuery = listQuery.not("published_at", "is", null);

    const [
      { data, error },
      { count: pendingCount, error: pendingCountError },
      { count: readyCount, error: readyCountError },
      { count: publishedCount, error: publishedCountError },
      { count: returnedCount, error: returnedCountError },
    ] = await Promise.all([
      listQuery,
      supabase
        .from("academy_publish_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("academy_publish_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .is("published_at", null),
      supabase
        .from("academy_publish_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .not("published_at", "is", null),
      supabase
        .from("academy_publish_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]);

    if (
      error ||
      pendingCountError ||
      readyCountError ||
      publishedCountError ||
      returnedCountError
    ) {
      return { ok: false, reason: "failed" };
    }

    const rows = (data ?? []) as RequestRow[];
    const truncated = rows.length > QUEUE_LIMIT;
    const slice = rows.slice(0, QUEUE_LIMIT);
    const programIds = [...new Set(slice.map((row) => row.program_id))];

    const programs = new Map<string, ProgramRow>();
    if (programIds.length > 0) {
      const { data: programRows, error: programError } = await supabase
        .from("academy_programs")
        .select("id, name, type, category, status")
        .in("id", programIds)
        .limit(programIds.length);
      if (programError) return { ok: false, reason: "failed" };
      for (const row of (programRows ?? []) as ProgramRow[]) {
        programs.set(row.id, row);
      }
    }

    const names = await displayNames(
      supabase,
      slice.map((row) => row.submitted_by_user_id),
    );

    const items: ApprovalQueueItem[] = [];
    for (const row of slice) {
      if (!isAcademyPublishRequestStatus(row.status)) continue;
      const program = programs.get(row.program_id);
      if (!program || !isAcademyProgramType(program.type)) continue;
      const programStatus = asProgramStatus(program.status);
      if (!programStatus) continue;
      const publishedAt = row.published_at;
      const stage = approvalStage({
        status: row.status,
        programStatus,
        publishedAt,
      });
      if (stage !== filter) continue;
      items.push({
        id: row.id,
        programId: row.program_id,
        programName: program.name,
        programType: program.type as AcademyProgramType,
        category: program.category ?? "",
        programStatus,
        submittedByName: names.get(row.submitted_by_user_id) || "Instructor",
        submittedAt: row.created_at,
        publishedAt,
        status: row.status,
      });
    }

    return {
      ok: true,
      data: {
        filter,
        items,
        truncated,
        counts: {
          pending: pendingCount ?? 0,
          ready: readyCount ?? 0,
          published: publishedCount ?? 0,
          returned: returnedCount ?? 0,
        },
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
