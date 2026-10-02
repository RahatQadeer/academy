import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { formatAssignmentCoverage } from "../lib/formatInstructorDates";
import { instructorInviteIsExpired } from "../lib/inviteExpiry";
import type {
  AdminInstructorListItem,
  AdminInstructorListResult,
  InstructorMembershipStatus,
  PendingInstructorInvite,
} from "../types";
import { INSTRUCTOR_LIMIT } from "../types";
import { UUID } from "../../types";

type MembershipRow = { user_id: string; status: string; granted_at: string | null };
type AssignmentRow = {
  user_id: string;
  permission_level: string;
  program_id: string;
  module_ids?: string[] | null;
};
type ProgramRow = { id: string; name: string; type: string };
type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

function asStatus(value: string): InstructorMembershipStatus | null {
  if (value === "active" || value === "suspended") return value;
  return null;
}

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Instructor ${userId.slice(0, 8)}`;
}

function formatAssignmentSummary(
  rows: { programName: string; moduleIds: string[] }[],
): string {
  if (rows.length === 0) return "—";
  return rows
    .map((row) => `${row.programName} — ${formatAssignmentCoverage(row.moduleIds, [])}`)
    .join("; ");
}

async function loadRoleSlice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: InstructorMembershipStatus,
) {
  const { data: memberships, error } = await supabase
    .from("academy_memberships")
    .select("user_id, status, granted_at")
    .eq("role", "instructor")
    .eq("status", status)
    .order("granted_at", { ascending: false })
    .limit(INSTRUCTOR_LIMIT + 1);
  if (error) return { ok: false as const };
  const rows = ((memberships ?? []) as MembershipRow[]).filter((row) => UUID.test(row.user_id));
  return {
    ok: true as const,
    truncated: rows.length > INSTRUCTOR_LIMIT,
    rows: rows.slice(0, INSTRUCTOR_LIMIT),
  };
}

export async function loadInstructors(): Promise<AdminInstructorListResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const [activeSlice, suspendedSlice] = await Promise.all([
      loadRoleSlice(supabase, "active"),
      loadRoleSlice(supabase, "suspended"),
    ]);
    if (!activeSlice.ok || !suspendedSlice.ok) return { ok: false, reason: "failed" };

    const allRows = [...activeSlice.rows, ...suspendedSlice.rows];
    const userIds = [...new Set(allRows.map((row) => row.user_id))];

    const grantedAtByUser = new Map(
      allRows.map((row) => [row.user_id, row.granted_at ?? null]),
    );

    const assignmentsByUser = new Map<
      string,
      { programName: string; moduleIds: string[] }[]
    >();
    const names = new Map<string, IdentityRow>();

    if (userIds.length > 0) {
      const [{ data: assignmentRows, error: assignmentError }, { data: identityRows, error: identityError }] =
        await Promise.all([
          supabase
            .from("academy_instructor_assignments")
            .select("user_id, permission_level, program_id, module_ids")
            .in("user_id", userIds)
            .limit(500),
          supabase.rpc("academy_admin_user_identities", { p_user_ids: userIds }),
        ]);
      if (identityError || assignmentError) return { ok: false, reason: "failed" };

      const programIds = [
        ...new Set(
          ((assignmentRows ?? []) as AssignmentRow[]).map((row) => row.program_id),
        ),
      ];
      const programsById = new Map<string, ProgramRow>();
      if (programIds.length > 0) {
        const { data: programRows, error: programError } = await supabase
          .from("academy_programs")
          .select("id, name, type")
          .in("id", programIds);
        if (programError) return { ok: false, reason: "failed" };
        for (const row of (programRows ?? []) as ProgramRow[]) {
          programsById.set(row.id, row);
        }
      }

      for (const row of (assignmentRows ?? []) as AssignmentRow[]) {
        const program = programsById.get(row.program_id);
        if (!program) continue;
        const existing = assignmentsByUser.get(row.user_id) ?? [];
        existing.push({
          programName: program.name,
          moduleIds: row.module_ids ?? [],
        });
        assignmentsByUser.set(row.user_id, existing);
      }

      for (const row of (identityRows ?? []) as IdentityRow[]) {
        names.set(row.id.toLowerCase(), row);
      }
    }

    function toItem(row: MembershipRow): AdminInstructorListItem | null {
      const status = asStatus(row.status);
      if (!status) return null;
      const identity = names.get(row.user_id.toLowerCase());
      const assignmentRows = assignmentsByUser.get(row.user_id) ?? [];
      return {
        userId: row.user_id,
        displayName: displayName(identity, row.user_id),
        email: identity?.email?.trim() || null,
        membershipStatus: status,
        assignmentCount: assignmentRows.length,
        assignmentSummary: formatAssignmentSummary(assignmentRows),
        assignedPrograms: assignmentRows.map((assignment) => assignment.programName),
        grantedAt: grantedAtByUser.get(row.user_id) ?? null,
      };
    }

    const instructorEmails = new Set(
      allRows
        .map((row) => names.get(row.user_id.toLowerCase())?.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );

    let pendingInvites: PendingInstructorInvite[] = [];
    if (isSupabaseAdminConfigured()) {
      const admin = createAdminClient();
      const { data: inviteRows } = await admin
        .from("invitations")
        .select("id, invitee_email, invitee_name, expires_at, sent_at, status")
        .eq("context_type", "academy_instructor")
        .in("status", ["pending", "expired"])
        .order("sent_at", { ascending: false })
        .limit(INSTRUCTOR_LIMIT);

      pendingInvites = ((inviteRows ?? []) as {
        id: string;
        invitee_email: string;
        invitee_name: string | null;
        expires_at: string | null;
        sent_at: string | null;
        status: string;
      }[])
        .filter((row) => !instructorEmails.has(row.invitee_email.trim().toLowerCase()))
        .map((row) => {
          const email = row.invitee_email.trim().toLowerCase();
          const name = (row.invitee_name || "").trim();
          return {
            id: row.id,
            email,
            displayName: name || email,
            expiresAt: row.expires_at,
            sentAt: row.sent_at,
            expired: row.status === "expired" || instructorInviteIsExpired(row.expires_at),
          };
        });
    }

    return {
      ok: true,
      data: {
        active: activeSlice.rows.map(toItem).filter((item): item is AdminInstructorListItem => Boolean(item)),
        suspended: suspendedSlice.rows
          .map(toItem)
          .filter((item): item is AdminInstructorListItem => Boolean(item)),
        pendingInvites,
        truncatedActive: activeSlice.truncated,
        truncatedSuspended: suspendedSlice.truncated,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
