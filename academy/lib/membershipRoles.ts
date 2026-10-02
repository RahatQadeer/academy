import "server-only";

import { cache } from "react";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { pickExclusiveAcademyRole } from "./exclusiveRole";
import type { AcademyRole } from "./types";

type MembershipRow = {
  role: AcademyRole;
  status: string;
};

/** Request-scoped overrides after membership writes in the same render. */
const roleOverrides = cache(() => new Map<string, Set<AcademyRole>>());

const loadActiveAcademyRoles = cache(async (userId: string): Promise<Set<AcademyRole>> => {
  if (!isSupabaseConfigured() || !userId) return new Set();

  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_memberships")
    .select("role, status")
    .eq("user_id", userId);

  const roles = new Set<AcademyRole>();
  for (const row of (data ?? []) as MembershipRow[]) {
    if (row.status === "active") roles.add(row.role);
  }

  const exclusive = pickExclusiveAcademyRole(roles);
  return exclusive ? new Set<AcademyRole>([exclusive]) : new Set();
});

/**
 * Active Academy role for a user. One email holds one role — if legacy
 * rows still stack, only the highest-privilege role is returned.
 */
export async function getActiveAcademyRoles(userId: string): Promise<Set<AcademyRole>> {
  if (!userId) return new Set();
  const override = roleOverrides().get(userId);
  if (override) return new Set(override);
  return loadActiveAcademyRoles(userId);
}

/** Call after granting/revoking a role in the same request so authz sees it. */
export function setActiveAcademyRolesOverride(userId: string, roles: Set<AcademyRole>) {
  if (!userId) return;
  roleOverrides().set(userId, new Set(roles));
}
