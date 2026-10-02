import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createClient } from "@/base/lib/supabase/server";
import { ensureBaseAccount } from "@/base/identity/bootstrap";
import { getSessionProfile } from "@/base/identity/session";
import { setActiveAcademyRolesOverride } from "./membershipRoles";
import type { AcademyActor } from "./types";

type MembershipRow = {
  role: "learner" | "instructor" | "admin";
  status: "active" | "suspended";
};

/** Request-scoped entitlement after a grant in the same render. */
const entitlementOverrides = cache(() => new Map<string, boolean>());

export function setAcademyEntitlementOverride(userId: string, entitled: boolean) {
  if (!userId) return;
  entitlementOverrides().set(userId, entitled);
}

/** Live DB check — never trust the per-request session profile cache after a grant. */
export async function userHasAcademyEntitlement(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const override = entitlementOverrides().get(userId);
  if (override !== undefined) return override;

  const { data } = await supabase
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("product", "academy")
    .in("status", ["active", "trial"])
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Request-scoped entitlement lookup. Overrides always win (checked outside
 * React cache) so a grant earlier in this request is visible immediately.
 */
export async function getAcademyEntitlement(userId: string): Promise<boolean> {
  if (!userId) return false;
  const override = entitlementOverrides().get(userId);
  if (override !== undefined) return override;
  return loadAcademyEntitlementOnce(userId);
}

const loadAcademyEntitlementOnce = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  return userHasAcademyEntitlement(supabase, userId);
});

/**
 * First Academy visit: ensure workspace + product entitlements exist, then
 * specifically guarantee an Academy trial row. Signup/login already try this;
 * entry self-heals when that path was skipped or the session cache was stale.
 */
export async function ensureAcademyEntitlement(user: AcademyActor): Promise<boolean> {
  const profile = await getSessionProfile();
  if (!profile || profile.user.id !== user.id) return false;

  const supabase = await createClient();

  try {
    await ensureBaseAccount(supabase, {
      id: profile.user.id,
      email: profile.user.email,
      user_metadata: { full_name: profile.user.full_name },
    });
  } catch {
    // Workspace / entitlement rows may already exist.
  }

  if (await userHasAcademyEntitlement(supabase, user.id)) {
    setAcademyEntitlementOverride(user.id, true);
    return true;
  }

  const { error } = await supabase.from("entitlements").insert({
    user_id: user.id,
    product: "academy",
    workspace_id: null,
    status: "trial",
    is_default_landing: false,
  });

  if (error && error.code !== "23505") {
    setAcademyEntitlementOverride(user.id, false);
    return false;
  }

  setAcademyEntitlementOverride(user.id, true);
  return true;
}

/**
 * Idempotent server-side Learner grant on the existing identity.
 * Never creates a second account. Never grants instructor or admin.
 * Never reads query params, client bodies, or a requested role.
 * Does not grant Learner when any other Academy role is already active
 * (one email = one Academy role).
 * If Learner was suspended and no staff role is active, reactivates Learner
 * so a former Admin/Instructor can return as Learner after revoke.
 */
export async function ensureLearnerMembership(user: AcademyActor): Promise<void> {
  const supabase = await createClient();
  if (!(await userHasAcademyEntitlement(supabase, user.id))) return;

  const { data } = await supabase
    .from("academy_memberships")
    .select("id, role, status")
    .eq("user_id", user.id);

  const rows = (data ?? []) as (MembershipRow & { id: string })[];
  const activeOther = rows.find((row) => row.status === "active" && row.role !== "learner");
  if (activeOther) {
    setActiveAcademyRolesOverride(user.id, new Set([activeOther.role]));
    return;
  }
  if (rows.some((row) => row.role === "learner" && row.status === "active")) {
    setActiveAcademyRolesOverride(user.id, new Set(["learner"]));
    return;
  }

  const suspendedLearner = rows.find((row) => row.role === "learner" && row.status === "suspended");
  if (suspendedLearner) {
    const { error: reactivateError } = await supabase
      .from("academy_memberships")
      .update({ status: "active" })
      .eq("id", suspendedLearner.id)
      .eq("role", "learner");
    if (reactivateError && reactivateError.code !== "23505") {
      throw reactivateError;
    }
    setActiveAcademyRolesOverride(user.id, new Set(["learner"]));
    return;
  }

  const { error } = await supabase.from("academy_memberships").insert({
    user_id: user.id,
    role: "learner",
    status: "active",
    granted_by_user_id: null,
  });

  if (error && error.code !== "23505") {
    throw error;
  }

  setActiveAcademyRolesOverride(user.id, new Set(["learner"]));
}
