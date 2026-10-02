import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { canAccessInstructorArea, isInstructor } from "@/academy/lib/authorization";
import { isGeneralBankProgram } from "@/academy/lib/questionBank/generalBankConstants";
import {
  isAcademyProgramType,
  type AcademyAssignmentPermission,
  type AcademyProgramStatus,
  type AcademyProgramType,
  type AcademyPublishRequestStatus,
} from "@/academy/lib/domain";
import type {
  InstructorDashboardData,
  InstructorDashboardResult,
  InstructorProgramItem,
} from "../types";
import { INSTRUCTOR_PROGRAM_LIMIT } from "../types";
import { needsAttention } from "../utils/labels";

type ProgramEmbed = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
  updated_at: string;
};

type AssignmentRow = {
  id: string;
  user_id: string;
  program_id: string;
  permission_level: string;
  created_at: string;
  academy_programs: ProgramEmbed | ProgramEmbed[] | null;
};

type PublishRow = {
  program_id: string;
  status: string;
  created_at: string;
};

type ModuleRow = { id: string; program_id: string };
type LessonRow = { id: string; module_id: string };

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>([
  "draft",
  "pending_approval",
  "published",
]);
const PERMISSIONS = new Set<AcademyAssignmentPermission>(["edit", "create"]);
const PUBLISH_STATUSES = new Set<AcademyPublishRequestStatus>([
  "pending",
  "approved",
  "rejected",
]);

function emptyDashboard(): InstructorDashboardData {
  return {
    programs: [],
    attention: [],
    stats: { assigned: 0, drafts: 0, pendingApproval: 0, published: 0, pendingReviews: 0 },
    truncated: false,
  };
}

function asProgram(value: AssignmentRow["academy_programs"]): ProgramEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asPermission(value: string): AcademyAssignmentPermission | null {
  return PERMISSIONS.has(value as AcademyAssignmentPermission)
    ? (value as AcademyAssignmentPermission)
    : null;
}

function asProgramStatus(value: string): AcademyProgramStatus | null {
  return PROGRAM_STATUSES.has(value as AcademyProgramStatus)
    ? (value as AcademyProgramStatus)
    : null;
}

function asPublishStatus(value: string): AcademyPublishRequestStatus | null {
  return PUBLISH_STATUSES.has(value as AcademyPublishRequestStatus)
    ? (value as AcademyPublishRequestStatus)
    : null;
}

function latestRequestByProgram(rows: PublishRow[]) {
  const latest = new Map<string, PublishRow>();
  for (const row of rows) {
    const current = latest.get(row.program_id);
    if (!current || row.created_at > current.created_at) {
      latest.set(row.program_id, row);
    }
  }
  return latest;
}

function sortPrograms(items: InstructorProgramItem[]) {
  return [...items].sort((a, b) => {
    const attentionDelta = Number(needsAttention(b)) - Number(needsAttention(a));
    if (attentionDelta !== 0) return attentionDelta;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function loadInstructorDashboard(
  userId: string,
): Promise<InstructorDashboardResult> {
  if (!userId) return { ok: true, data: emptyDashboard() };

  try {
    const actor = { id: userId };
    const [area, instructor] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
    ]);
    if (!area || !instructor) return { ok: true, data: emptyDashboard() };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_instructor_assignments")
      .select(
        "id, user_id, program_id, permission_level, created_at, academy_programs ( id, name, type, category, status, updated_at )",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(INSTRUCTOR_PROGRAM_LIMIT + 1);

    if (error) return { ok: false };

    const rows = (data ?? []) as AssignmentRow[];
    const truncated = rows.length > INSTRUCTOR_PROGRAM_LIMIT;
    const visible = rows.slice(0, INSTRUCTOR_PROGRAM_LIMIT);

    const byProgram = new Map<string, InstructorProgramItem>();
    for (const row of visible) {
      if (row.user_id !== userId) continue;
      const program = asProgram(row.academy_programs);
      if (!program || program.id !== row.program_id) continue;
      if (isGeneralBankProgram(program)) continue;
      if (!isAcademyProgramType(program.type)) continue;
      const permission = asPermission(row.permission_level);
      const status = asProgramStatus(program.status);
      if (!permission || !status) continue;
      if (byProgram.has(program.id)) continue;

      byProgram.set(program.id, {
        assignmentId: row.id,
        programId: program.id,
        programName: program.name,
        programType: program.type as AcademyProgramType,
        category: program.category,
        permissionLevel: permission,
        programStatus: status,
        updatedAt: program.updated_at,
        moduleCount: 0,
        lessonCount: 0,
        publishRequestStatus: null,
        publishRequestedAt: null,
      });
    }

    const { data: createdRows, error: createdError } = await supabase
      .from("academy_programs")
      .select("id, name, type, category, status, updated_at")
      .eq("created_by_user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(INSTRUCTOR_PROGRAM_LIMIT);

    if (createdError) return { ok: false };

    for (const program of (createdRows ?? []) as ProgramEmbed[]) {
      if (byProgram.has(program.id)) continue;
      if (isGeneralBankProgram(program)) continue;
      if (!isAcademyProgramType(program.type)) continue;
      const status = asProgramStatus(program.status);
      if (!status) continue;
      byProgram.set(program.id, {
        assignmentId: `created:${program.id}`,
        programId: program.id,
        programName: program.name,
        programType: program.type as AcademyProgramType,
        category: program.category,
        permissionLevel: "create",
        programStatus: status,
        updatedAt: program.updated_at,
        moduleCount: 0,
        lessonCount: 0,
        publishRequestStatus: null,
        publishRequestedAt: null,
      });
    }

    const programIds = [...byProgram.keys()];
    if (programIds.length > 0) {
      const [{ data: requestRows, error: requestError }, { data: moduleRows, error: moduleError }] =
        await Promise.all([
          supabase
            .from("academy_publish_requests")
            .select("program_id, status, created_at")
            .in("program_id", programIds)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("academy_modules")
            .select("id, program_id")
            .in("program_id", programIds)
            .limit(500),
        ]);

      if (requestError || moduleError) return { ok: false };

      const latest = latestRequestByProgram((requestRows ?? []) as PublishRow[]);
      for (const [programId, request] of latest) {
        const item = byProgram.get(programId);
        const status = asPublishStatus(request.status);
        if (!item || !status) continue;
        item.publishRequestStatus = status;
        item.publishRequestedAt = request.created_at;
      }

      const modules = (moduleRows ?? []) as ModuleRow[];
      const moduleIds: string[] = [];
      for (const module of modules) {
        const item = byProgram.get(module.program_id);
        if (!item) continue;
        item.moduleCount += 1;
        moduleIds.push(module.id);
      }

      if (moduleIds.length > 0) {
        const { data: lessonRows, error: lessonError } = await supabase
          .from("academy_lessons")
          .select("id, module_id")
          .in("module_id", moduleIds)
          .limit(2000);
        if (lessonError) return { ok: false };

        const programByModule = new Map<string, string>();
        for (const module of modules) {
          programByModule.set(module.id, module.program_id);
        }
        for (const lesson of (lessonRows ?? []) as LessonRow[]) {
          const programId = programByModule.get(lesson.module_id);
          const item = programId ? byProgram.get(programId) : undefined;
          if (!item) continue;
          item.lessonCount += 1;
        }
      }
    }

    const programs = sortPrograms([...byProgram.values()]);
    const attention = programs.filter(needsAttention);
    const stats = {
      assigned: programs.length,
      drafts: programs.filter((item) => item.programStatus === "draft").length,
      pendingApproval: programs.filter(
        (item) =>
          item.programStatus === "pending_approval" || item.publishRequestStatus === "pending",
      ).length,
      published: programs.filter((item) => item.programStatus === "published").length,
      pendingReviews: 0,
    };

    if (programIds.length > 0) {
      const { count } = await supabase
        .from("academy_assignment_submissions")
        .select("id", { count: "exact", head: true })
        .in("program_id", programIds)
        .eq("status", "submitted");
      stats.pendingReviews = count ?? 0;
    }

    return { ok: true, data: { programs, attention, stats, truncated } };
  } catch {
    return { ok: false };
  }
}
