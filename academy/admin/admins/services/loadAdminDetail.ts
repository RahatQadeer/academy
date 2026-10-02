import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import {
  loadAdminStaffMetrics,
  loadAssignmentsMadeBy,
  loadInstructorsGrantedBy,
  loadInstructorsRevokedBy,
  loadProgramsCreatedBy,
  loadPublishRequestsForReviewer,
  type AdminStaffMetrics,
  type StaffAssignmentRef,
  type StaffCreatedProgram,
  type StaffPersonRef,
  type StaffPublishRequest,
} from "@/academy/admin/services/staffPersonMetrics";
import type { AcademyAdminMembershipStatus } from "../types";
import { UUID } from "../../types";
import { requireAcademySuperAdminActor } from "./requireSuperAdmin";

type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

export type AcademyAdminDetail = {
  userId: string;
  displayName: string;
  email: string | null;
  membershipStatus: AcademyAdminMembershipStatus;
  grantedAt: string | null;
  metrics: AdminStaffMetrics;
  programs: StaffCreatedProgram[];
  approvalsAccepted: StaffPublishRequest[];
  approvalsReturned: StaffPublishRequest[];
  instructorsGranted: StaffPersonRef[];
  instructorsRevoked: StaffPersonRef[];
  assignments: StaffAssignmentRef[];
};

export type AcademyAdminDetailResult =
  | { ok: true; data: AcademyAdminDetail }
  | { ok: false; reason: "unauthorized" | "not_admin" | "not_found" | "failed" };

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Admin ${userId.slice(0, 8)}`;
}

export async function loadAdminDetail(userIdRaw: string): Promise<AcademyAdminDetailResult> {
  const userId = userIdRaw.trim().toLowerCase();
  if (!UUID.test(userId)) return { ok: false, reason: "not_found" };

  try {
    const actor = await requireAcademySuperAdminActor();
    if (!actor.ok) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("academy_memberships")
      .select("status, granted_at")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (membershipError) return { ok: false, reason: "failed" };
    const membershipRow = membership as { status: string; granted_at: string | null } | null;
    if (!membershipRow) return { ok: false, reason: "not_admin" };
    if (membershipRow.status !== "active" && membershipRow.status !== "suspended") {
      return { ok: false, reason: "not_admin" };
    }

    const [
      { data: identities, error: identityError },
      metrics,
      programs,
      approvalsAccepted,
      approvalsReturned,
      instructorsGranted,
      instructorsRevoked,
      assignments,
    ] = await Promise.all([
      supabase.rpc("academy_admin_user_identities", { p_user_ids: [userId] }),
      loadAdminStaffMetrics(supabase, userId),
      loadProgramsCreatedBy(supabase, userId),
      loadPublishRequestsForReviewer(supabase, userId, "approved"),
      loadPublishRequestsForReviewer(supabase, userId, "rejected"),
      loadInstructorsGrantedBy(supabase, userId),
      loadInstructorsRevokedBy(userId),
      loadAssignmentsMadeBy(supabase, userId),
    ]);

    if (identityError) return { ok: false, reason: "failed" };
    const identity = ((identities ?? []) as IdentityRow[])[0];

    return {
      ok: true,
      data: {
        userId,
        displayName: displayName(identity, userId),
        email: identity?.email?.trim() || null,
        membershipStatus: membershipRow.status,
        grantedAt: membershipRow.granted_at,
        metrics,
        programs,
        approvalsAccepted,
        approvalsReturned,
        instructorsGranted,
        instructorsRevoked,
        assignments,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
