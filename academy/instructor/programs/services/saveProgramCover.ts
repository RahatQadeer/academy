import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { canAuthorProgram } from "@/academy/lib/authorization";
import { getSessionProfile } from "@/base/identity/session";
import type { SaveProgramCoverResult } from "../types";
import { loadInstructorAssignmentScope } from "./loadInstructorAssignmentScope";
import { PROGRAM_ID } from "../utils/validation";

export async function saveProgramCover(
  programIdRaw: string,
  coverImageUrl: string,
): Promise<SaveProgramCoverResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const programId = programIdRaw.trim().toLowerCase();
    if (!PROGRAM_ID.test(programId)) return { ok: false, reason: "unauthorized" };

    const [allowed, assignmentScope] = await Promise.all([
      canAuthorProgram({ id: profile.user.id }, programId),
      loadInstructorAssignmentScope(profile.user.id, programId),
    ]);
    if (!allowed) return { ok: false, reason: "unauthorized" };
    if (assignmentScope && assignmentScope.moduleIds.length > 0) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "Cover image is managed at the program level by an Academy Admin.",
      };
    }

    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase
      .from("academy_programs")
      .select("id, status")
      .eq("id", programId)
      .maybeSingle();
    if (currentError || !current) return { ok: false, reason: "failed", message: "The cover image could not be saved." };
    if ((current as { status?: string }).status === "published") {
      return { ok: false, reason: "published", message: "Live programs cannot be edited here." };
    }

    const { error } = await supabase
      .from("academy_programs")
      .update({ cover_image_url: coverImageUrl.trim() || null })
      .eq("id", programId)
      .neq("status", "published");
    if (error) {
      return { ok: false, reason: "failed", message: "The cover image could not be saved." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The cover image could not be saved." };
  }
}
