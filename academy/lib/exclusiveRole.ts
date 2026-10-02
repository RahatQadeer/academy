import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademyRole } from "./types";
import {
  academyRoleLabel,
  exclusiveRoleConflictMessage,
  pickExclusiveAcademyRole,
} from "./exclusiveRolePick";

export {
  academyRoleLabel,
  exclusiveRoleConflictMessage,
  pickExclusiveAcademyRole,
};

type MembershipRow = {
  role: AcademyRole;
  status: string;
};

export async function findActiveRoleConflict(
  supabase: SupabaseClient,
  userId: string,
  intended: AcademyRole,
): Promise<AcademyRole | null> {
  const { data, error } = await supabase
    .from("academy_memberships")
    .select("role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;

  for (const row of (data ?? []) as MembershipRow[]) {
    if (row.role !== intended) return row.role;
  }
  return null;
}
