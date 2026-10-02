import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { isAcademyAssignmentPermission } from "@/academy/lib/domain";
import { normalizeAssignmentModuleIds } from "../lib/assignmentScope";
import type {
  UpdateInstructorAssignmentInput,
  UpdateInstructorAssignmentResult,
} from "../types";
import { UUID } from "../../types";

export async function updateInstructorAssignment(
  input: UpdateInstructorAssignmentInput,
): Promise<UpdateInstructorAssignmentResult> {
  const assignmentId = input.assignmentId.trim().toLowerCase();
  if (!UUID.test(assignmentId)) {
    return { ok: false, reason: "not_found", message: "That assignment could not be found." };
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
    const { data: existing, error: loadError } = await supabase
      .from("academy_instructor_assignments")
      .select("id, user_id, program_id")
      .eq("id", assignmentId)
      .maybeSingle();
    if (loadError) {
      return { ok: false, reason: "failed", message: "The assignment could not be updated." };
    }
    const row = existing as { id: string; user_id: string; program_id: string } | null;
    if (!row) return { ok: false, reason: "not_found", message: "That assignment could not be found." };

    const { error: updateError } = await supabase
      .from("academy_instructor_assignments")
      .update({
        permission_level: input.permission,
        module_ids: normalizeAssignmentModuleIds(input.moduleIds),
        ...(input.canPublishWithoutApproval !== undefined
          ? { can_publish_without_approval: Boolean(input.canPublishWithoutApproval) }
          : {}),
      })
      .eq("id", assignmentId);
    if (updateError) {
      return { ok: false, reason: "failed", message: "The assignment could not be updated." };
    }

    return { ok: true, userId: row.user_id, programId: row.program_id };
  } catch {
    return { ok: false, reason: "failed", message: "The assignment could not be updated." };
  }
}
