import "server-only";

import { createAdminClient, isSupabaseAdminConfigured } from "@/base/lib/supabase/admin";
import { getSessionProfile } from "@/base/identity/session";
import { canPerform } from "@/academy/lib/capabilities";
import {
  ACADEMY_AUDIT_ENTITY_USER,
  writeAcademyAdminAudit,
} from "@/academy/lib/adminAudit";
import { UUID } from "@/academy/admin/types";
import type {
  ManagedUserStatus,
  SetUserStatusAction,
  SetUserStatusResult,
} from "../types";

function nextStatus(action: SetUserStatusAction): ManagedUserStatus {
  if (action === "suspend") return "suspended";
  if (action === "soft_delete") return "deleted";
  return "active";
}

function capabilityFor(action: SetUserStatusAction) {
  if (action === "soft_delete") return "users.delete" as const;
  return "users.suspend" as const;
}

/**
 * Soft account lifecycle on public.users.status only.
 * Does not rewrite email (unlike permanent closeAccount).
 * Does not create tables.
 */
export async function setUserAccountStatus(
  userIdRaw: string,
  action: SetUserStatusAction,
): Promise<SetUserStatusResult> {
  const userId = userIdRaw.trim().toLowerCase();
  if (!UUID.test(userId)) {
    return { ok: false, reason: "not_found", message: "That user could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };

    const allowed = await canPerform(actor, capabilityFor(action));
    if (!allowed) return { ok: false, reason: "unauthorized" };

    if (actor.id.toLowerCase() === userId) {
      return {
        ok: false,
        reason: "self",
        message: "You cannot change the status of your own account.",
      };
    }

    if (!isSupabaseAdminConfigured()) {
      return {
        ok: false,
        reason: "unavailable",
        message: "User management is not configured on this environment.",
      };
    }

    const admin = createAdminClient();

    const { data: target, error: loadError } = await admin
      .from("users")
      .select("id, status")
      .eq("id", userId)
      .maybeSingle();

    if (loadError || !target) {
      return { ok: false, reason: "not_found", message: "That user could not be found." };
    }

    const previous = (target as { status: string }).status;
    if (previous !== "active" && previous !== "suspended" && previous !== "deleted") {
      return { ok: false, reason: "failed", message: "That account status is not supported." };
    }

    if (action === "suspend" && previous !== "active") {
      return { ok: false, reason: "invalid", message: "Only active accounts can be suspended." };
    }
    if (action === "restore" && previous !== "suspended") {
      return { ok: false, reason: "invalid", message: "Only suspended accounts can be restored this way." };
    }
    if (action === "soft_delete" && previous === "deleted") {
      return { ok: false, reason: "invalid", message: "That account is already soft-deleted." };
    }
    if (action === "restore_deleted" && previous !== "deleted") {
      return { ok: false, reason: "invalid", message: "Only soft-deleted accounts can be restored this way." };
    }

    const { data: superRow } = await admin
      .from("academy_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .eq("status", "active")
      .maybeSingle();

    if (superRow && (action === "suspend" || action === "soft_delete")) {
      return {
        ok: false,
        reason: "protected",
        message: "Active Academy Super Admins cannot be suspended or soft-deleted here.",
      };
    }

    const status = nextStatus(action);

    const { error: updateError } = await admin
      .from("users")
      .update({ status })
      .eq("id", userId);

    if (updateError) {
      return { ok: false, reason: "failed", message: "The account status could not be updated." };
    }

    // Best-effort auth ban so suspended/deleted users cannot sign in.
    try {
      if (status === "active") {
        await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      } else {
        await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      }
    } catch {
      // Status row is source of truth; ban is best-effort.
    }

    if (status !== "active") {
      try {
        await admin.auth.admin.signOut(userId, "global");
      } catch {
        // ignore
      }
    }

    await writeAcademyAdminAudit(
      {
        actorUserId: actor.id,
        entityType: ACADEMY_AUDIT_ENTITY_USER,
        entityId: userId,
        action,
        previousValue: { status: previous },
        newValue: { status, result: "ok" },
      },
      admin,
    );

    return { ok: true, userId, status };
  } catch {
    return { ok: false, reason: "failed", message: "The account status could not be updated." };
  }
}
