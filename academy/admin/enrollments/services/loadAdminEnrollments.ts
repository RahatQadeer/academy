import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  isAcademyEnrollmentStatus,
  isAcademyProgramType,
  type AcademyEnrollmentStatus,
  type AcademyProgramStatus,
} from "@/academy/lib/domain";
import type { AdminEnrollmentsResult, EnrollmentKpis, ProgramEnrollmentRow } from "../types";
import { ENROLLMENT_SCAN_LIMIT, PROGRAM_ROW_LIMIT } from "../types";
import { UUID } from "../../types";

type EnrollmentScanRow = { program_id: string; status: string };
type ProgramRow = {
  id: string;
  name: string;
  type: string;
  category: string | null;
  status: string;
};

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);

type ProgramCounts = {
  enrolled: number;
  inProgress: number;
  completed: number;
};

function emptyCounts(): ProgramCounts {
  return { enrolled: 0, inProgress: 0, completed: 0 };
}

function bump(counts: ProgramCounts, status: AcademyEnrollmentStatus) {
  if (status === "enrolled") counts.enrolled += 1;
  else if (status === "in_progress") counts.inProgress += 1;
  else counts.completed += 1;
}

export async function loadAdminEnrollments(): Promise<AdminEnrollmentsResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const [
      { count: total, error: totalError },
      { count: enrolled, error: enrolledError },
      { count: inProgress, error: inProgressError },
      { count: completed, error: completedError },
    ] = await Promise.all([
      supabase.from("academy_enrollments").select("id", { count: "exact", head: true }),
      supabase.from("academy_enrollments").select("id", { count: "exact", head: true }).eq("status", "enrolled"),
      supabase.from("academy_enrollments").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("academy_enrollments").select("id", { count: "exact", head: true }).eq("status", "completed"),
    ]);

    if (totalError || enrolledError || inProgressError || completedError) {
      return { ok: false, reason: "failed" };
    }

    const kpis: EnrollmentKpis = {
      total: total ?? 0,
      enrolled: enrolled ?? 0,
      inProgress: inProgress ?? 0,
      completed: completed ?? 0,
    };

    if (kpis.total === 0) {
      return { ok: true, data: { kpis, programs: [], truncatedPrograms: false, truncatedScan: false } };
    }

    const { data: scanRows, error: scanError } = await supabase
      .from("academy_enrollments")
      .select("program_id, status")
      .limit(ENROLLMENT_SCAN_LIMIT + 1);
    if (scanError) return { ok: false, reason: "failed" };

    const scan = (scanRows ?? []) as EnrollmentScanRow[];
    const truncatedScan = scan.length > ENROLLMENT_SCAN_LIMIT;
    const slice = scan.slice(0, ENROLLMENT_SCAN_LIMIT);

    const byProgram = new Map<string, ProgramCounts>();
    for (const row of slice) {
      if (!UUID.test(row.program_id) || !isAcademyEnrollmentStatus(row.status)) continue;
      const current = byProgram.get(row.program_id) ?? emptyCounts();
      bump(current, row.status);
      byProgram.set(row.program_id, current);
    }

    const ranked = [...byProgram.entries()]
      .map(([programId, counts]) => ({
        programId,
        total: counts.enrolled + counts.inProgress + counts.completed,
        ...counts,
      }))
      .sort((a, b) => b.total - a.total || a.programId.localeCompare(b.programId));

    const truncatedPrograms = ranked.length > PROGRAM_ROW_LIMIT;
    const top = ranked.slice(0, PROGRAM_ROW_LIMIT);
    const programIds = top.map((item) => item.programId);

    const programsById = new Map<string, ProgramRow>();
    if (programIds.length > 0) {
      const { data: programRows, error: programError } = await supabase
        .from("academy_programs")
        .select("id, name, type, category, status")
        .in("id", programIds)
        .limit(programIds.length);
      if (programError) return { ok: false, reason: "failed" };
      for (const row of (programRows ?? []) as ProgramRow[]) {
        programsById.set(row.id, row);
      }
    }

    const programs: ProgramEnrollmentRow[] = [];
    for (const item of top) {
      const program = programsById.get(item.programId);
      if (!program || !isAcademyProgramType(program.type)) continue;
      const status = PROGRAM_STATUSES.has(program.status as AcademyProgramStatus)
        ? (program.status as AcademyProgramStatus)
        : null;
      if (!status) continue;
      programs.push({
        programId: item.programId,
        programName: program.name,
        programType: program.type,
        category: program.category ?? "",
        programStatus: status,
        total: item.total,
        enrolled: item.enrolled,
        inProgress: item.inProgress,
        completed: item.completed,
      });
    }

    return {
      ok: true,
      data: { kpis, programs, truncatedPrograms, truncatedScan },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
