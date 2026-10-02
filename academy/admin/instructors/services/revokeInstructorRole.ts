import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  ACADEMY_AUDIT_ENTITY_MEMBERSHIP,
  writeAcademyAdminAudit,
} from "@/academy/lib/adminAudit";
import type { RevokeInstructorRoleResult } from "../types";
import { UUID } from "../../types";

type MembershipRow = { id: string; status: string };

export async function revokeInstructorRole(userIdRaw: string): Promise<RevokeInstructorRoleResult> {
  const userId = userIdRaw.trim().toLowerCase();
  if (!UUID.test(userId)) {
    return { ok: false, reason: "not_found", message: "That Instructor could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from("academy_memberships")
      .select("id, status")
      .eq("user_id", userId)
      .eq("role", "instructor")
      .maybeSingle();
    if (loadError) return { ok: false, reason: "failed", message: "The Instructor role could not be revoked." };

    const membership = existing as MembershipRow | null;
    if (!membership) {
      return { ok: false, reason: "not_found", message: "That user is not an Academy Instructor." };
    }

    if (membership.status === "suspended") {
      return { ok: true, userId };
    }

    const { error: updateError } = await supabase
      .from("academy_memberships")
      .update({ status: "suspended" })
      .eq("id", membership.id)
      .eq("role", "instructor");
    if (updateError) {
      return { ok: false, reason: "failed", message: "The Instructor role could not be revoked." };
    }

    await writeAcademyAdminAudit({
      actorUserId: actor.id,
      entityType: ACADEMY_AUDIT_ENTITY_MEMBERSHIP,
      entityId: userId,
      action: "revoke_instructor",
      previousValue: { role: "instructor", status: "active" },
      newValue: { role: "instructor", status: "suspended" },
    });

    return { ok: true, userId };
  } catch {
    return { ok: false, reason: "failed", message: "The Instructor role could not be revoked." };
  }
}
