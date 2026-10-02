import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { isAcademyAssignmentPermission } from "@/academy/lib/domain";
import { normalizeAssignmentModuleIds } from "../lib/assignmentScope";
import type { AssignInstructorInput, AssignInstructorResult } from "../types";
import { UUID } from "../../types";

export async function assignInstructor(input: AssignInstructorInput): Promise<AssignInstructorResult> {
  const userId = input.userId.trim().toLowerCase();
  const programId = input.programId.trim().toLowerCase();
  if (!UUID.test(userId) || !UUID.test(programId)) {
    return { ok: false, reason: "invalid", message: "Choose a valid instructor and program." };
  }
  if (!isAcademyAssignmentPermission(input.permission)) {
    return { ok: false, reason: "invalid", message: "Permission must be Edit or Create." };
  }

  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
    if (!area || !admin) return { ok: false, reason: "unauthorized" };

    const supabase = await createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("academy_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "instructor")
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) return { ok: false, reason: "failed", message: "The assignment could not be created." };
    if (!membership) {
      return {
        ok: false,
        reason: "not_instructor",
        message: "This user is not an Academy Instructor.",
      };
    }

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select("id")
      .eq("id", programId)
      .maybeSingle();
    if (programError) return { ok: false, reason: "failed", message: "The assignment could not be created." };
    if (!program) return { ok: false, reason: "not_found", message: "That program could not be found." };

    const { data: existing, error: existingError } = await supabase
      .from("academy_instructor_assignments")
      .select("id")
      .eq("user_id", userId)
      .eq("program_id", programId)
      .limit(1);
    if (existingError) return { ok: false, reason: "failed", message: "The assignment could not be created." };
    if ((existing ?? []).length > 0) {
      return { ok: false, reason: "already_assigned", message: "This instructor is already assigned to that program." };
    }

    const { error: insertError } = await supabase.from("academy_instructor_assignments").insert({
      user_id: userId,
      program_id: programId,
      permission_level: input.permission,
      module_ids: normalizeAssignmentModuleIds(input.moduleIds),
      can_publish_without_approval: Boolean(input.canPublishWithoutApproval),
      assigned_by_admin_user_id: actor.id,
    });
    if (insertError) return { ok: false, reason: "failed", message: "The assignment could not be created." };

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The assignment could not be created." };
  }
}
