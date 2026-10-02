import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { isAcademyEnrollmentStatus } from "@/academy/lib/domain";
import type {
  ProgramEnrollmentListItem,
  ProgramEnrollmentListResult,
} from "../types";
import { PROGRAM_ENROLLMENT_LIMIT } from "../types";
import { UUID } from "../../types";

type EnrollmentRow = {
  id: string;
  user_id: string;
  status: string;
  progress_percent: number | null;
  enrolled_at: string;
};

type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Learner ${userId.slice(0, 8)}`;
}

function progressPercent(value: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function loadProgramEnrollments(programIdRaw: string): Promise<ProgramEnrollmentListResult> {
  const programId = programIdRaw.trim().toLowerCase();
  if (!UUID.test(programId)) return { ok: false, reason: "not_found" };

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select("id, name")
      .eq("id", programId)
      .maybeSingle();
    if (programError) return { ok: false, reason: "failed" };
    const programRow = program as { id: string; name: string } | null;
    if (!programRow) return { ok: false, reason: "not_found" };

    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("academy_enrollments")
      .select("id, user_id, status, progress_percent, enrolled_at")
      .eq("program_id", programId)
      .order("enrolled_at", { ascending: false })
      .limit(PROGRAM_ENROLLMENT_LIMIT + 1);
    if (enrollmentError) return { ok: false, reason: "failed" };

    const rows = ((enrollmentRows ?? []) as EnrollmentRow[]).filter((row) => UUID.test(row.id));
    const truncated = rows.length > PROGRAM_ENROLLMENT_LIMIT;
    const slice = rows.slice(0, PROGRAM_ENROLLMENT_LIMIT);
    const userIds = [...new Set(slice.map((row) => row.user_id).filter((id) => UUID.test(id)))];

    const names = new Map<string, IdentityRow>();
    if (userIds.length > 0) {
      const { data: identityRows, error: identityError } = await supabase.rpc("academy_admin_user_identities", {
        p_user_ids: userIds,
      });
      if (identityError) return { ok: false, reason: "failed" };
      for (const row of (identityRows ?? []) as IdentityRow[]) {
        names.set(row.id.toLowerCase(), row);
      }
    }

    const items: ProgramEnrollmentListItem[] = [];
    for (const row of slice) {
      if (!isAcademyEnrollmentStatus(row.status)) continue;
      const identity = names.get(row.user_id.toLowerCase());
      items.push({
        enrollmentId: row.id,
        displayName: displayName(identity, row.user_id),
        email: identity?.email?.trim() || null,
        status: row.status,
        progressPercent: progressPercent(row.progress_percent),
        enrolledAt: row.enrolled_at,
      });
    }

    return {
      ok: true,
      data: {
        programId,
        programName: programRow.name,
        items,
        truncated,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
