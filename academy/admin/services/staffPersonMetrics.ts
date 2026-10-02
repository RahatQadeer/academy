import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { ACADEMY_AUDIT_ENTITY_MEMBERSHIP } from "@/academy/lib/adminAudit";
import { isAcademyProgramType, type AcademyProgramStatus } from "@/academy/lib/domain";
import {
  STAFF_LIST_LIMIT,
  type AdminStaffMetrics,
  type InstructorStaffMetrics,
  type StaffAssignmentRef,
  type StaffCreatedProgram,
  type StaffPersonRef,
  type StaffPublishRequest,
} from "@/academy/admin/lib/staffActivityTypes";

export type {
  AdminStaffMetrics,
  InstructorStaffMetrics,
  StaffAssignmentRef,
  StaffCreatedProgram,
  StaffPersonRef,
  StaffPublishRequest,
} from "@/academy/admin/lib/staffActivityTypes";
export { STAFF_LIST_LIMIT, STAFF_PAGE_SIZE } from "@/academy/admin/lib/staffActivityTypes";

const PROGRAM_STATUSES = new Set<AcademyProgramStatus>(["draft", "pending_approval", "published"]);

type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};

function asProgramStatus(value: string): AcademyProgramStatus | null {
  return PROGRAM_STATUSES.has(value as AcademyProgramStatus)
    ? (value as AcademyProgramStatus)
    : null;
}

function personName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `User ${userId.slice(0, 8)}`;
}

async function loadIdentities(supabase: SupabaseClient, userIds: string[]) {
  const map = new Map<string, IdentityRow>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data } = await supabase.rpc("academy_admin_user_identities", { p_user_ids: ids });
  for (const row of (data ?? []) as IdentityRow[]) {
    map.set(row.id.toLowerCase(), row);
  }
  return map;
}

async function programNames(supabase: SupabaseClient, programIds: string[]) {
  const map = new Map<string, string>();
  const ids = [...new Set(programIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const { data } = await supabase.from("academy_programs").select("id, name").in("id", ids);
  for (const row of (data ?? []) as { id: string; name: string }[]) {
    map.set(row.id, row.name);
  }
  return map;
}

export async function loadProgramsCreatedBy(
  supabase: SupabaseClient,
  userId: string,
): Promise<StaffCreatedProgram[]> {
  const { data, error } = await supabase
    .from("academy_programs")
    .select("id, name, status, type, category, updated_at")
    .eq("created_by_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(STAFF_LIST_LIMIT);

  if (error) return [];

  return ((data ?? []) as {
    id: string;
    name: string;
    status: string;
    type: string;
    category: string | null;
    updated_at: string | null;
  }[])
    .map((row) => {
      const status = asProgramStatus(row.status);
      if (!status || !isAcademyProgramType(row.type)) return null;
      return {
        id: row.id,
        name: row.name,
        status,
        type: row.type,
        category: (row.category || "").trim(),
        updatedAt: row.updated_at,
      };
    })
    .filter((row): row is StaffCreatedProgram => Boolean(row));
}

export async function loadPublishRequestsForReviewer(
  supabase: SupabaseClient,
  adminUserId: string,
  status: "approved" | "rejected",
): Promise<StaffPublishRequest[]> {
  const { data, error } = await supabase
    .from("academy_publish_requests")
    .select("id, program_id, status, reviewed_at, created_at")
    .eq("reviewed_by_admin_user_id", adminUserId)
    .eq("status", status)
    .order("reviewed_at", { ascending: false })
    .limit(STAFF_LIST_LIMIT);

  if (error) return [];
  const rows = (data ?? []) as {
    id: string;
    program_id: string;
    status: string;
    reviewed_at: string | null;
    created_at: string | null;
  }[];
  const names = await programNames(
    supabase,
    rows.map((row) => row.program_id),
  );

  return rows.map((row) => ({
    id: row.id,
    programId: row.program_id,
    programName: names.get(row.program_id) || "Program",
    status,
    at: row.reviewed_at || row.created_at,
  }));
}

export async function loadPublishRequestsSubmittedBy(
  supabase: SupabaseClient,
  instructorUserId: string,
  status?: "pending" | "approved" | "rejected",
): Promise<StaffPublishRequest[]> {
  let query = supabase
    .from("academy_publish_requests")
    .select("id, program_id, status, reviewed_at, created_at")
    .eq("submitted_by_user_id", instructorUserId)
    .order("created_at", { ascending: false })
    .limit(STAFF_LIST_LIMIT);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return [];

  const rows = (data ?? []) as {
    id: string;
    program_id: string;
    status: string;
    reviewed_at: string | null;
    created_at: string | null;
  }[];
  const names = await programNames(
    supabase,
    rows.map((row) => row.program_id),
  );

  return rows
    .filter(
      (row): row is typeof row & { status: "pending" | "approved" | "rejected" } =>
        row.status === "pending" || row.status === "approved" || row.status === "rejected",
    )
    .map((row) => ({
      id: row.id,
      programId: row.program_id,
      programName: names.get(row.program_id) || "Program",
      status: row.status,
      at: row.reviewed_at || row.created_at,
    }));
}

export async function loadInstructorsGrantedBy(
  supabase: SupabaseClient,
  adminUserId: string,
): Promise<StaffPersonRef[]> {
  const { data, error } = await supabase
    .from("academy_memberships")
    .select("user_id, granted_at")
    .eq("role", "instructor")
    .eq("granted_by_user_id", adminUserId)
    .order("granted_at", { ascending: false })
    .limit(STAFF_LIST_LIMIT);

  if (error) return [];
  const rows = (data ?? []) as { user_id: string; granted_at: string | null }[];
  const identities = await loadIdentities(
    supabase,
    rows.map((row) => row.user_id),
  );

  return rows.map((row) => {
    const identity = identities.get(row.user_id.toLowerCase());
    return {
      userId: row.user_id,
      displayName: personName(identity, row.user_id),
      email: identity?.email?.trim() || null,
      at: row.granted_at,
    };
  });
}

export async function loadInstructorsRevokedBy(adminUserId: string): Promise<StaffPersonRef[]> {
  if (!isSupabaseAdminConfigured()) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("audit_log")
    .select("entity_id, created_at")
    .eq("entity_type", ACADEMY_AUDIT_ENTITY_MEMBERSHIP)
    .eq("action", "revoke_instructor")
    .eq("actor_user_id", adminUserId)
    .order("created_at", { ascending: false })
    .limit(STAFF_LIST_LIMIT);

  if (error) return [];
  const rows = (data ?? []) as { entity_id: string; created_at: string }[];
  const identities = await loadIdentities(
    admin,
    rows.map((row) => row.entity_id),
  );

  return rows.map((row) => {
    const identity = identities.get(row.entity_id.toLowerCase());
    return {
      userId: row.entity_id,
      displayName: personName(identity, row.entity_id),
      email: identity?.email?.trim() || null,
      at: row.created_at,
    };
  });
}

export async function loadAssignmentsMadeBy(
  supabase: SupabaseClient,
  adminUserId: string,
): Promise<StaffAssignmentRef[]> {
  const { data, error } = await supabase
    .from("academy_instructor_assignments")
    .select("id, program_id, user_id, created_at")
    .eq("assigned_by_admin_user_id", adminUserId)
    .order("created_at", { ascending: false })
    .limit(STAFF_LIST_LIMIT);

  if (error) return [];
  const rows = (data ?? []) as {
    id: string;
    program_id: string;
    user_id: string;
    created_at: string | null;
  }[];
  const [names, identities] = await Promise.all([
    programNames(
      supabase,
      rows.map((row) => row.program_id),
    ),
    loadIdentities(
      supabase,
      rows.map((row) => row.user_id),
    ),
  ]);

  return rows.map((row) => {
    const identity = identities.get(row.user_id.toLowerCase());
    return {
      id: row.id,
      programId: row.program_id,
      programName: names.get(row.program_id) || "Program",
      instructorUserId: row.user_id,
      instructorName: personName(identity, row.user_id),
      at: row.created_at,
    };
  });
}

export async function loadAdminStaffMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminStaffMetrics> {
  const [
    { count: coursesCreated },
    { count: approvalsAccepted },
    { count: approvalsReturned },
    { count: instructorsGranted },
    { count: assignmentsMade },
  ] = await Promise.all([
    supabase
      .from("academy_programs")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", userId),
    supabase
      .from("academy_publish_requests")
      .select("id", { count: "exact", head: true })
      .eq("reviewed_by_admin_user_id", userId)
      .eq("status", "approved"),
    supabase
      .from("academy_publish_requests")
      .select("id", { count: "exact", head: true })
      .eq("reviewed_by_admin_user_id", userId)
      .eq("status", "rejected"),
    supabase
      .from("academy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("role", "instructor")
      .eq("granted_by_user_id", userId),
    supabase
      .from("academy_instructor_assignments")
      .select("id", { count: "exact", head: true })
      .eq("assigned_by_admin_user_id", userId),
  ]);

  let instructorsRevoked = 0;
  if (isSupabaseAdminConfigured()) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("entity_type", ACADEMY_AUDIT_ENTITY_MEMBERSHIP)
      .eq("action", "revoke_instructor")
      .eq("actor_user_id", userId);
    instructorsRevoked = count ?? 0;
  }

  return {
    coursesCreated: coursesCreated ?? 0,
    approvalsAccepted: approvalsAccepted ?? 0,
    approvalsReturned: approvalsReturned ?? 0,
    instructorsGranted: instructorsGranted ?? 0,
    instructorsRevoked,
    assignmentsMade: assignmentsMade ?? 0,
  };
}

export async function loadInstructorStaffMetrics(
  supabase: SupabaseClient,
  userId: string,
): Promise<InstructorStaffMetrics> {
  const [
    { count: coursesCreated },
    { count: publishRequestsSent },
    { count: publishPending },
    { count: publishApproved },
    { count: publishReturned },
    { count: programsAssigned },
  ] = await Promise.all([
    supabase
      .from("academy_programs")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", userId),
    supabase
      .from("academy_publish_requests")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by_user_id", userId),
    supabase
      .from("academy_publish_requests")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by_user_id", userId)
      .eq("status", "pending"),
    supabase
      .from("academy_publish_requests")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by_user_id", userId)
      .eq("status", "approved"),
    supabase
      .from("academy_publish_requests")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by_user_id", userId)
      .eq("status", "rejected"),
    supabase
      .from("academy_instructor_assignments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    coursesCreated: coursesCreated ?? 0,
    publishRequestsSent: publishRequestsSent ?? 0,
    publishPending: publishPending ?? 0,
    publishApproved: publishApproved ?? 0,
    publishReturned: publishReturned ?? 0,
    programsAssigned: programsAssigned ?? 0,
  };
}
