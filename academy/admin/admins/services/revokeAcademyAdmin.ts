import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type { RevokeAcademyAdminResult } from "../types";
import { UUID } from "../../types";
import { requireAcademySuperAdminActor } from "./requireSuperAdmin";

function rpcFailure(error: { message?: string } | null): RevokeAcademyAdminResult {
  const text = error?.message ?? "";
  if (text.includes("academy_admin_unauthorized")) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "Only the Academy Super Admin can revoke Admin.",
    };
  }
  if (text.includes("academy_admin_not_found")) {
    return { ok: false, reason: "not_found", message: "That user is not an Academy Admin." };
  }
  if (text.includes("academy_last_admin_required")) {
    return {
      ok: false,
      reason: "last_admin",
      message: "At least one active Academy Admin is required.",
    };
  }
  return { ok: false, reason: "failed", message: "The Admin role could not be revoked." };
}

export async function revokeAcademyAdmin(userIdRaw: string): Promise<RevokeAcademyAdminResult> {
  const userId = userIdRaw.trim().toLowerCase();
  if (!UUID.test(userId)) {
    return { ok: false, reason: "not_found", message: "That user is not an Academy Admin." };
  }

  try {
    const actor = await requireAcademySuperAdminActor();
    if (!actor.ok) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { count: activeCount, error: countError } = await supabase
      .from("academy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "active");
    if (countError) {
      return { ok: false, reason: "failed", message: "The Admin role could not be revoked." };
    }

    const { data: target, error: loadError } = await supabase
      .from("academy_memberships")
      .select("id, status")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (loadError) {
      return { ok: false, reason: "failed", message: "The Admin role could not be revoked." };
    }
    const row = target as { id: string; status: string } | null;
    if (!row) {
      return { ok: false, reason: "not_found", message: "That user is not an Academy Admin." };
    }
    if (row.status === "active" && (activeCount ?? 0) <= 1) {
      return {
        ok: false,
        reason: "last_admin",
        message: "At least one active Academy Admin is required.",
      };
    }

    const { data, error } = await supabase.rpc("academy_revoke_admin", { p_user_id: userId });
    if (error) return rpcFailure(error);

    const status = typeof data === "string" ? data : "";
    if (status !== "suspended" && status !== "already_suspended") {
      return { ok: false, reason: "failed", message: "The Admin role could not be revoked." };
    }
    return { ok: true, userId };
  } catch {
    return { ok: false, reason: "failed", message: "The Admin role could not be revoked." };
  }
}
