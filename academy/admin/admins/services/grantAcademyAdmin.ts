import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import {
  exclusiveRoleConflictMessage,
  findActiveRoleConflict,
} from "@/academy/lib/exclusiveRole";
import type { GrantAcademyAdminOutcome, GrantAcademyAdminResult } from "../types";
import { UUID } from "../../types";
import { requireAcademySuperAdminActor } from "./requireSuperAdmin";

function rpcMessage(error: { message?: string } | null) {
  const text = error?.message ?? "";
  if (text.includes("academy_admin_unauthorized")) {
    return {
      reason: "unauthorized" as const,
      message: "Only the Academy Super Admin can grant Admin.",
    };
  }
  if (text.includes("academy_admin_self_grant")) {
    return {
      reason: "failed" as const,
      message: "You cannot grant Admin to yourself.",
    };
  }
  if (text.includes("academy_admin_user_not_found")) {
    return { reason: "not_found" as const, message: "That user could not be found." };
  }
  if (text.includes("academy_role_conflict")) {
    return {
      reason: "role_conflict" as const,
      message:
        "This account already has another Academy role. Remove that role first — one email can only hold one Academy role at a time.",
    };
  }
  return { reason: "failed" as const, message: "The Admin role could not be granted." };
}

function asOutcome(value: string | null): GrantAcademyAdminOutcome | null {
  if (value === "granted" || value === "reactivated" || value === "already_admin") return value;
  return null;
}

/**
 * Suspends active Learner so Super Admin can promote the same email to Admin
 * in one step (default Academy identity is Learner).
 */
async function clearLearnerConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("academy_memberships")
    .select("id, status")
    .eq("user_id", userId)
    .eq("role", "learner")
    .maybeSingle();

  if (error) {
    return { ok: false, message: "The Learner role could not be cleared before granting Admin." };
  }
  if (!data || data.status !== "active") return { ok: true };

  const { error: updateError } = await supabase
    .from("academy_memberships")
    .update({ status: "suspended" })
    .eq("id", data.id)
    .eq("role", "learner");

  if (updateError) {
    return { ok: false, message: "The Learner role could not be cleared before granting Admin." };
  }
  return { ok: true };
}

export async function grantAcademyAdmin(userIdRaw: string): Promise<GrantAcademyAdminResult> {
  const userId = userIdRaw.trim().toLowerCase();
  if (!UUID.test(userId)) {
    return { ok: false, reason: "not_found", message: "That user could not be found." };
  }

  try {
    const actor = await requireAcademySuperAdminActor();
    if (!actor.ok) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    let conflict = await findActiveRoleConflict(supabase, userId, "admin");

    if (conflict === "learner") {
      const cleared = await clearLearnerConflict(supabase, userId);
      if (!cleared.ok) {
        return { ok: false, reason: "failed", message: cleared.message };
      }
      conflict = await findActiveRoleConflict(supabase, userId, "admin");
    }

    if (conflict) {
      return {
        ok: false,
        reason: "role_conflict",
        message: exclusiveRoleConflictMessage("admin", conflict),
        conflictRole: conflict,
      };
    }

    const { data, error } = await supabase.rpc("academy_grant_admin", { p_user_id: userId });
    if (error) {
      const mapped = rpcMessage(error);
      return { ok: false, reason: mapped.reason, message: mapped.message };
    }

    const outcome = asOutcome(typeof data === "string" ? data : null);
    if (!outcome) {
      return { ok: false, reason: "failed", message: "The Admin role could not be granted." };
    }
    return { ok: true, outcome, userId };
  } catch {
    return { ok: false, reason: "failed", message: "The Admin role could not be granted." };
  }
}
