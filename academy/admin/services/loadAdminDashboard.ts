import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  isAcademyEnrollmentStatus,
  type AcademyProgramStatus,
} from "@/academy/lib/domain";
import type {
  AdminDashboardEnrollmentRow,
  AdminDashboardProgramRow,
  AdminDashboardResult,
} from "../types";
import { UUID } from "../types";

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);
const RECENT_LIMIT = 6;

type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

function displayName(row: IdentityRow | undefined, userId: string): string {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Learner ${userId.slice(0, 8)}`;
}

function formatLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

function asProgramStatus(value: string): AcademyProgramStatus | null {
  return PROGRAM_STATUSES.has(value as AcademyProgramStatus)
    ? (value as AcademyProgramStatus)
    : null;
}

export async function loadAdminDashboard(): Promise<AdminDashboardResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const [
      { count: pendingCount, error: pendingError },
      { count: credentialReviewCount, error: credentialReviewError },
      { count: instructorCount, error: instructorError },
      { count: suspendedInstructorCount, error: suspendedError },
      { count: adminCount, error: adminError },
      { count: suspendedAdminCount, error: suspendedAdminError },
      { count: learnerCount, error: learnerError },
      { count: suspendedLearnerCount, error: suspendedLearnerError },
      { count: superAdminCount, error: superAdminError },
      { count: suspendedMembershipTotal, error: suspendedMembershipError },
      { count: enrollmentCount, error: enrollmentError },
      { count: enrollmentActiveCount, error: enrollmentActiveError },
      { count: enrollmentCompletedCount, error: enrollmentCompletedError },
      { data: programRows, error: programError },
      { data: recentProgramRows, error: recentProgramError },
      { data: recentEnrollmentRows, error: recentEnrollmentError },
    ] = await Promise.all([
      supabase
        .from("academy_publish_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("academy_credentials")
        .select("id", { count: "exact", head: true })
        .eq("status", "credential_review"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "instructor")
        .eq("status", "active"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "instructor")
        .eq("status", "suspended"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "active"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "suspended"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "learner")
        .eq("status", "active"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "learner")
        .eq("status", "suspended"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin")
        .eq("status", "active"),
      supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("status", "suspended"),
      supabase.from("academy_enrollments").select("id", { count: "exact", head: true }),
      supabase
        .from("academy_enrollments")
        .select("id", { count: "exact", head: true })
        .in("status", ["enrolled", "in_progress"]),
      supabase
        .from("academy_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      supabase.from("academy_programs").select("status"),
      supabase
        .from("academy_programs")
        .select("id, name, status, updated_at, created_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(RECENT_LIMIT),
      supabase
        .from("academy_enrollments")
        .select("id, user_id, program_id, status, enrolled_at")
        .order("enrolled_at", { ascending: false })
        .limit(RECENT_LIMIT),
    ]);

    if (
      pendingError ||
      credentialReviewError ||
      instructorError ||
      suspendedError ||
      adminError ||
      suspendedAdminError ||
      learnerError ||
      suspendedLearnerError ||
      superAdminError ||
      suspendedMembershipError ||
      enrollmentError ||
      enrollmentActiveError ||
      enrollmentCompletedError ||
      programError ||
      recentProgramError ||
      recentEnrollmentError
    ) {
      return { ok: false, reason: "failed" };
    }

    let programPublished = 0;
    let programDraft = 0;
    let programPendingApproval = 0;
    for (const row of programRows ?? []) {
      switch ((row as { status: string }).status) {
        case "published":
          programPublished += 1;
          break;
        case "pending_approval":
          programPendingApproval += 1;
          break;
        case "draft":
          programDraft += 1;
          break;
        default:
          break;
      }
    }

    const recentPrograms: AdminDashboardProgramRow[] = [];
    for (const row of (recentProgramRows ?? []) as {
      id: string;
      name: string;
      status: string;
      updated_at: string | null;
      created_at: string | null;
    }[]) {
      const status = asProgramStatus(row.status);
      if (!status) continue;
      recentPrograms.push({
        id: row.id,
        name: row.name,
        status,
        updatedLabel: formatLabel(row.updated_at ?? row.created_at),
      });
    }

    const enrollmentScan = (recentEnrollmentRows ?? []) as {
      id: string;
      user_id: string;
      program_id: string;
      status: string;
      enrolled_at: string | null;
    }[];

    const userIds = [...new Set(enrollmentScan.map((row) => row.user_id))].filter((id) => UUID.test(id));
    const programIds = [...new Set(enrollmentScan.map((row) => row.program_id))];
    const names = new Map<string, IdentityRow>();
    const programNames = new Map<string, string>();

    if (userIds.length > 0 || programIds.length > 0) {
      // Learner identities live behind RLS, so read them through the
      // security-definer RPC instead of querying `users` directly.
      const [{ data: identityRows }, { data: programs }] = await Promise.all([
        userIds.length > 0
          ? supabase.rpc("academy_admin_user_identities", { p_user_ids: userIds })
          : Promise.resolve({ data: [] as IdentityRow[] }),
        programIds.length > 0
          ? supabase.from("academy_programs").select("id, name").in("id", programIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);

      for (const row of (identityRows ?? []) as IdentityRow[]) {
        names.set(row.id.toLowerCase(), row);
      }
      for (const row of programs ?? []) {
        programNames.set(row.id, row.name);
      }
    }

    const recentEnrollments: AdminDashboardEnrollmentRow[] = [];
    for (const row of enrollmentScan) {
      if (!isAcademyEnrollmentStatus(row.status)) continue;
      recentEnrollments.push({
        id: row.id,
        programId: row.program_id,
        learnerName: displayName(names.get(row.user_id.toLowerCase()), row.user_id),
        programName: programNames.get(row.program_id) ?? "Program",
        status: row.status,
        enrolledLabel: formatLabel(row.enrolled_at),
      });
    }

    return {
      ok: true,
      data: {
        pendingCount: pendingCount ?? 0,
        credentialReviewCount: credentialReviewCount ?? 0,
        instructorCount: instructorCount ?? 0,
        suspendedInstructorCount: suspendedInstructorCount ?? 0,
        adminCount: adminCount ?? 0,
        suspendedAdminCount: suspendedAdminCount ?? 0,
        learnerCount: learnerCount ?? 0,
        superAdminCount: superAdminCount ?? 0,
        suspendedLearnerCount: suspendedLearnerCount ?? 0,
        suspendedMembershipTotal: suspendedMembershipTotal ?? 0,
        enrollmentCount: enrollmentCount ?? 0,
        enrollmentActiveCount: enrollmentActiveCount ?? 0,
        enrollmentCompletedCount: enrollmentCompletedCount ?? 0,
        programTotal: (programRows ?? []).length,
        programPublished,
        programDraft,
        programPendingApproval,
        recentPrograms,
        recentEnrollments,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
