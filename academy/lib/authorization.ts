import "server-only";

import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getActiveAcademyRoles } from "./membershipRoles";
import { getAcademyEntitlement } from "./provision";
import type { AcademyActor, AcademyRole } from "./types";

type AuthzContext = {
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  roles: Set<AcademyRole>;
};

/**
 * Deduped per request — keyed by user id so every `can*` check shares one
 * memberships lookup on the critical path. Entitlement is read live (with
 * request override) so a grant earlier in the same render is visible.
 */
const loadContext = cache(
  async (userId: string): Promise<AuthzContext | null> => {
    const profile = await getSessionProfile();
    if (!profile || profile.user.id !== userId) {
      return null;
    }

    const [supabase, roles] = await Promise.all([
      createClient(),
      getActiveAcademyRoles(userId),
    ]);

    return { userId, supabase, roles };
  },
);

async function hasEntitlement(userId: string) {
  return getAcademyEntitlement(userId);
}

async function liveRoles(userId: string) {
  // Prefer live lookup so a grant earlier in this request is visible (overrides).
  return getActiveAcademyRoles(userId);
}

/** True when the exclusive active role is Academy Super Admin. */
export function rolesIncludeSuperAdmin(roles: Set<AcademyRole>): boolean {
  return roles.has("super_admin");
}

/**
 * Academy Admin privileges — includes Super Admin so existing admin gates
 * keep working without updating every call site.
 */
export function rolesIncludeAdminPrivileges(roles: Set<AcademyRole>): boolean {
  return roles.has("admin") || roles.has("super_admin");
}

export async function canAccessAcademy(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx) return false;
  return hasEntitlement(user.id);
}

export async function hasAcademyRole(
  user: AcademyActor,
  role: AcademyRole,
): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx) return false;
  const roles = await liveRoles(user.id);
  return roles.has(role);
}

export async function isLearner(user: AcademyActor): Promise<boolean> {
  return hasAcademyRole(user, "learner");
}

export async function isInstructor(user: AcademyActor): Promise<boolean> {
  return hasAcademyRole(user, "instructor");
}

/**
 * Academy Admin *or* Super Admin.
 * Prefer `isAcademySuperAdmin` when the action must be Super-Admin-only.
 */
export async function isAcademyAdmin(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx) return false;
  const roles = await liveRoles(user.id);
  return rolesIncludeAdminPrivileges(roles);
}

/** Strict Super Admin check — does not treat plain Admin as Super Admin. */
export async function isAcademySuperAdmin(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx) return false;
  const roles = await liveRoles(user.id);
  return rolesIncludeSuperAdmin(roles);
}

export async function canAccessLearnerArea(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  return roles.has("learner");
}

export async function canAccessInstructorArea(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  return roles.has("instructor");
}

/** Admin dashboard / APIs — Super Admin inherits this. */
export async function canAccessAdminArea(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  return rolesIncludeAdminPrivileges(roles);
}

/**
 * Privileged Super Admin surface / APIs.
 * Plain Academy Admins must not pass this check.
 */
export async function canAccessSuperAdminArea(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  return rolesIncludeSuperAdmin(roles);
}

export async function isAssignedInstructor(
  user: AcademyActor,
  programId: string,
): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  if (!roles.has("instructor")) return false;

  const { data } = await ctx.supabase
    .from("academy_instructor_assignments")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .maybeSingle();

  return Boolean(data);
}

export async function canCreateProgram(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  return roles.has("instructor");
}

/**
 * Originate a new catalog program (manual or Whitby) on the Admin path.
 * Plain Academy Admin only — Super Admin manages the platform but does not
 * create programs. Instructors use `canCreateProgram` on their own surface.
 */
export async function canCreateCatalogProgram(user: AcademyActor): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  return roles.has("admin");
}

export async function canAuthorProgram(
  user: AcademyActor,
  programId: string,
): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  if (rolesIncludeAdminPrivileges(roles)) return true;
  if (!roles.has("instructor") || !programId) return false;

  const { data: assignment } = await ctx.supabase
    .from("academy_instructor_assignments")
    .select("permission_level")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .maybeSingle();
  const level = (assignment as { permission_level?: string } | null)?.permission_level;
  if (level === "edit" || level === "create") return true;

  const { data: created } = await ctx.supabase
    .from("academy_programs")
    .select("id")
    .eq("id", programId)
    .eq("created_by_user_id", user.id)
    .maybeSingle();
  return Boolean(created);
}

export async function canEditProgram(
  user: AcademyActor,
  programId: string,
): Promise<boolean> {
  return canAuthorProgram(user, programId);
}

export async function canSubmitPublishRequest(
  user: AcademyActor,
  programId: string,
): Promise<boolean> {
  return canAuthorProgram(user, programId);
}

export async function canApprovePublishRequest(
  user: AcademyActor,
  requestId: string,
): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  if (!rolesIncludeAdminPrivileges(roles)) return false;

  const { data } = await ctx.supabase
    .from("academy_publish_requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();

  return Boolean(data);
}

export async function instructorCanPublishWithoutApproval(
  user: AcademyActor,
  programId: string,
): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !programId || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  if (!roles.has("instructor")) return false;

  const { data } = await ctx.supabase
    .from("academy_instructor_assignments")
    .select("can_publish_without_approval")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .maybeSingle();

  return Boolean((data as { can_publish_without_approval?: boolean } | null)?.can_publish_without_approval);
}

export async function canPublishProgram(
  user: AcademyActor,
  programId: string,
): Promise<boolean> {
  const ctx = await loadContext(user.id);
  if (!ctx || !programId || !(await hasEntitlement(user.id))) return false;
  const roles = await liveRoles(user.id);
  if (rolesIncludeAdminPrivileges(roles)) return true;
  if (!roles.has("instructor")) return false;
  if (!(await canAuthorProgram(user, programId))) return false;
  if (await instructorCanPublishWithoutApproval(user, programId)) return true;

  const { data } = await ctx.supabase
    .from("academy_publish_requests")
    .select("id")
    .eq("program_id", programId)
    .eq("status", "approved")
    .is("published_at", null)
    .limit(1);

  return (data ?? []).length > 0;
}
