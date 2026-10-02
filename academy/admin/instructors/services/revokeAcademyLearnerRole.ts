import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { UUID } from "../../types";

export type RevokeAcademyLearnerResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason: "unauthorized" | "not_found" | "failed";
      message?: string;
    };

/** Suspends active Learner membership so the email can take Instructor (or Admin). */
export async function revokeAcademyLearnerRole(userIdRaw: string): Promise<RevokeAcademyLearnerResult> {
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
    const { data, error } = await supabase
      .from("academy_memberships")
      .select("id, status")
      .eq("user_id", userId)
      .eq("role", "learner")
      .maybeSingle();

    if (error) {
      return { ok: false, reason: "failed", message: "The Learner role could not be removed." };
    }
    if (!data) {
      return { ok: false, reason: "not_found", message: "This account has no Learner role." };
    }
    if (data.status !== "active") {
      return { ok: true, userId };
    }

    const { error: updateError } = await supabase
      .from("academy_memberships")
      .update({ status: "suspended" })
      .eq("id", data.id)
      .eq("role", "learner");

    if (updateError) {
      return { ok: false, reason: "failed", message: "The Learner role could not be removed." };
    }

    return { ok: true, userId };
  } catch {
    return { ok: false, reason: "failed", message: "The Learner role could not be removed." };
  }
}
