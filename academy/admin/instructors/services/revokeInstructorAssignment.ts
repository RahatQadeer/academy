import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import type { RevokeAssignmentResult } from "../types";
import { UUID } from "../../types";

export async function revokeInstructorAssignment(
  assignmentIdRaw: string,
): Promise<RevokeAssignmentResult> {
  const assignmentId = assignmentIdRaw.trim().toLowerCase();
  if (!UUID.test(assignmentId)) {
    return { ok: false, reason: "not_found", message: "That assignment could not be found." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: existing, error: loadError } = await supabase
      .from("academy_instructor_assignments")
      .select("id, user_id, program_id")
      .eq("id", assignmentId)
      .maybeSingle();
    if (loadError) return { ok: false, reason: "failed", message: "The assignment could not be revoked." };
    const row = existing as { id: string; user_id: string; program_id: string } | null;
    if (!row) return { ok: false, reason: "not_found", message: "That assignment could not be found." };

    const { error: deleteError } = await supabase
      .from("academy_instructor_assignments")
      .delete()
      .eq("id", assignmentId);
    if (deleteError) return { ok: false, reason: "failed", message: "The assignment could not be revoked." };

    return { ok: true, userId: row.user_id, programId: row.program_id };
  } catch {
    return { ok: false, reason: "failed", message: "The assignment could not be revoked." };
  }
}
