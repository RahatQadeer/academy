import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  exclusiveRoleConflictMessage,
  findActiveRoleConflict,
} from "@/academy/lib/exclusiveRole";
import type { GrantInstructorResult } from "../types";
import { UUID } from "../../types";

type IdentityRow = { id: string };
type MembershipRow = { id: string; status: string };

async function lookupUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.rpc("academy_admin_user_identities", {
    p_user_ids: [userId],
  });
  if (error) return { ok: false as const };
  const row = ((data ?? []) as IdentityRow[]).find((item) => item.id.toLowerCase() === userId);
  return row ? { ok: true as const, row } : { ok: false as const };
}

export async function grantInstructorRole(userIdRaw: string): Promise<GrantInstructorResult> {
  const userId = userIdRaw.trim().toLowerCase();
  if (!UUID.test(userId)) {
    return { ok: false, reason: "not_found", message: "That user could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const found = await lookupUser(supabase, userId);
    if (!found.ok) return { ok: false, reason: "not_found", message: "That user could not be found." };

    const conflict = await findActiveRoleConflict(supabase, userId, "instructor");
    if (conflict) {
      return {
        ok: false,
        reason: "role_conflict",
        message: exclusiveRoleConflictMessage("instructor", conflict),
        conflictRole: conflict,
      };
    }

    const { data: existing, error: loadError } = await supabase
      .from("academy_memberships")
      .select("id, status")
      .eq("user_id", userId)
      .eq("role", "instructor")
      .maybeSingle();
    if (loadError) return { ok: false, reason: "failed", message: "The Instructor role could not be granted." };

    const membership = existing as MembershipRow | null;
    if (membership?.status === "active") {
      return { ok: true, outcome: "already_instructor", userId };
    }

    if (membership) {
      const { error: updateError } = await supabase
        .from("academy_memberships")
        .update({
          status: "active",
          granted_by_user_id: actor.id,
          granted_at: new Date().toISOString(),
        })
        .eq("id", membership.id)
        .eq("role", "instructor");
      if (updateError) {
        return { ok: false, reason: "failed", message: "The Instructor role could not be granted." };
      }
      return { ok: true, outcome: "reactivated", userId };
    }

    const { error: insertError } = await supabase.from("academy_memberships").insert({
      user_id: userId,
      role: "instructor",
      status: "active",
      granted_by_user_id: actor.id,
    });

    if (insertError?.code === "23505") {
      const { data: raced } = await supabase
        .from("academy_memberships")
        .select("id, status")
        .eq("user_id", userId)
        .eq("role", "instructor")
        .maybeSingle();
      const racedRow = raced as MembershipRow | null;
      if (racedRow?.status === "active") {
        return { ok: true, outcome: "already_instructor", userId };
      }
      if (racedRow) {
        const { error: raceUpdateError } = await supabase
          .from("academy_memberships")
          .update({
            status: "active",
            granted_by_user_id: actor.id,
            granted_at: new Date().toISOString(),
          })
          .eq("id", racedRow.id)
          .eq("role", "instructor");
        if (raceUpdateError) {
          return { ok: false, reason: "failed", message: "The Instructor role could not be granted." };
        }
        return { ok: true, outcome: "reactivated", userId };
      }
      return { ok: false, reason: "failed", message: "The Instructor role could not be granted." };
    }

    if (insertError) {
      if (insertError.message?.includes("academy_role_conflict")) {
        return {
          ok: false,
          reason: "role_conflict",
          message:
            "This account already has another Academy role. Remove that role first — one email can only hold one Academy role at a time.",
        };
      }
      return { ok: false, reason: "failed", message: "The Instructor role could not be granted." };
    }

    return { ok: true, outcome: "granted", userId };
  } catch {
    return { ok: false, reason: "failed", message: "The Instructor role could not be granted." };
  }
}
