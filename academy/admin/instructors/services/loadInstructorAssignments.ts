import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  isAcademyAssignmentPermission,
  isAcademyProgramType,
  type AcademyProgramStatus,
} from "@/academy/lib/domain";
import type {
  AssignableProgram,
  InstructorAssignmentItem,
  InstructorAssignmentLoadResult,
} from "../types";
import { ASSIGNMENT_LIMIT, PROGRAM_LIMIT } from "../types";
import { UUID } from "../../types";

type AssignmentRow = {
  id: string;
  program_id: string;
  permission_level: string;
  can_publish_without_approval?: boolean;
  created_at: string;
  module_ids?: string[] | null;
};

type ModuleRow = {
  id: string;
  program_id: string;
  title: string;
  sort_order: number;
};

type ProgramRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
};

type IdentityRow = {
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);

function asProgramStatus(value: string): AcademyProgramStatus | null {
  return PROGRAM_STATUSES.has(value as AcademyProgramStatus) ? (value as AcademyProgramStatus) : null;
}

export async function loadInstructorAssignments(
  userId: string,
): Promise<InstructorAssignmentLoadResult> {
  if (!UUID.test(userId)) return { ok: false, reason: "not_found" };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("academy_memberships")
      .select("id, status, granted_at")
      .eq("user_id", userId)
      .eq("role", "instructor")
      .maybeSingle();

    if (membershipError) return { ok: false, reason: "failed" };
    const membershipRow = membership as {
      id: string;
      status: string;
      granted_at: string | null;
    } | null;
    if (!membershipRow) return { ok: false, reason: "not_instructor" };
    if (membershipRow.status !== "active" && membershipRow.status !== "suspended") {
      return { ok: false, reason: "not_instructor" };
    }

    const [{ data: assignmentRows, error: assignmentError }, { data: catalogRows, error: catalogError }, { data: identities, error: identityError }] =
      await Promise.all([
        supabase
          .from("academy_instructor_assignments")
          .select("id, program_id, permission_level, can_publish_without_approval, created_at, module_ids")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(ASSIGNMENT_LIMIT),
        supabase
          .from("academy_programs")
          .select("id, name, type, category, status")
          .order("name", { ascending: true })
          .limit(PROGRAM_LIMIT),
        supabase.rpc("academy_admin_user_identities", { p_user_ids: [userId] }),
      ]);

    if (assignmentError || catalogError || identityError) {
      return { ok: false, reason: "failed" };
    }

    const { loadInstructorActivity } = await import("./loadInstructorActivity");
    const {
      loadInstructorStaffMetrics,
      loadProgramsCreatedBy,
      loadPublishRequestsSubmittedBy,
    } = await import("@/academy/admin/services/staffPersonMetrics");
    const [recentActivity, metrics, createdPrograms, publishRequests] = await Promise.all([
      loadInstructorActivity(userId),
      loadInstructorStaffMetrics(supabase, userId),
      loadProgramsCreatedBy(supabase, userId),
      loadPublishRequestsSubmittedBy(supabase, userId),
    ]);

    const assignmentList = (assignmentRows ?? []) as AssignmentRow[];
    const assignedProgramIds = [...new Set(assignmentList.map((row) => row.program_id))];

    const programs = new Map<string, ProgramRow>();
    const assignable: AssignableProgram[] = [];
    for (const row of (catalogRows ?? []) as ProgramRow[]) {
      const status = asProgramStatus(row.status);
      if (!status || !isAcademyProgramType(row.type)) continue;
      programs.set(row.id, row);
      assignable.push({ id: row.id, name: row.name, status });
    }

    const modulesByProgram = new Map<string, { id: string; title: string; sortOrder: number }[]>();
    if (assignedProgramIds.length > 0) {
      const { data: moduleRows } = await supabase
        .from("academy_modules")
        .select("id, program_id, title, sort_order")
        .in("program_id", assignedProgramIds)
        .order("sort_order", { ascending: true });
      for (const row of (moduleRows ?? []) as ModuleRow[]) {
        const list = modulesByProgram.get(row.program_id) ?? [];
        list.push({ id: row.id, title: row.title, sortOrder: row.sort_order ?? 0 });
        modulesByProgram.set(row.program_id, list);
      }
    }

    if (assignedProgramIds.length > 0) {
      const missing = assignedProgramIds.filter((id) => !programs.has(id));
      if (missing.length > 0) {
        const { data: extraRows, error: extraError } = await supabase
          .from("academy_programs")
          .select("id, name, type, category, status")
          .in("id", missing)
          .limit(missing.length);
        if (extraError) return { ok: false, reason: "failed" };
        for (const row of (extraRows ?? []) as ProgramRow[]) {
          programs.set(row.id, row);
        }
      }
    }

    const assignedIds = new Set<string>();
    const assignments: InstructorAssignmentItem[] = [];
    for (const row of assignmentList) {
      if (!isAcademyAssignmentPermission(row.permission_level)) continue;
      const program = programs.get(row.program_id);
      if (!program) continue;
      const status = asProgramStatus(program.status);
      if (!status || !isAcademyProgramType(program.type)) continue;
      assignedIds.add(row.program_id);
      assignments.push({
        id: row.id,
        programId: row.program_id,
        programName: program.name,
        programType: program.type,
        category: program.category ?? "",
        programStatus: status,
        permission: row.permission_level,
        canPublishWithoutApproval: Boolean(row.can_publish_without_approval),
        moduleIds: row.module_ids ?? [],
        modules: modulesByProgram.get(row.program_id) ?? [],
        createdAt: row.created_at,
      });
    }

    const identity = ((identities ?? []) as IdentityRow[])[0];
    const displayName =
      (identity?.preferred_name || identity?.full_name || identity?.email || "").trim() ||
      `Instructor ${userId.slice(0, 8)}`;

    return {
      ok: true,
      data: {
        userId,
        displayName,
        email: identity?.email?.trim() || null,
        membershipStatus: membershipRow.status,
        grantedAt: membershipRow.granted_at ?? null,
        assignments,
        assignablePrograms: assignable.filter((program) => !assignedIds.has(program.id)),
        recentActivity,
        metrics,
        createdPrograms,
        publishRequests,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
