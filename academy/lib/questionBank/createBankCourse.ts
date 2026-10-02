import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  canCreateCatalogProgram,
  canCreateProgram,
  isInstructor,
} from "@/academy/lib/authorization";
import {
  TITLE_MAX,
  validateProgramName,
} from "@/academy/instructor/programs/utils/validation";

export type CreateBankCourseResult =
  | { ok: true; programId: string; name: string }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "failed";
      message: string;
    };

/**
 * Lightweight draft course for question-bank authorship.
 * Full outline/pricing stays in the catalog / instructor builder.
 */
export async function createBankCourse(input: {
  name: string;
}): Promise<CreateBankCourseResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, reason: "unauthorized", message: "Sign in required." };
    }

    const name = validateProgramName(input.name);
    if (!name) {
      return {
        ok: false,
        reason: "invalid",
        message: `Enter a course name (up to ${TITLE_MAX} characters).`,
      };
    }

    const actor = { id: profile.user.id };
    const [adminArea, canCreateCatalog, instructorArea, instructor, canCreate] = await Promise.all([
      canAccessAdminArea(actor),
      canCreateCatalogProgram(actor),
      canAccessInstructorArea(actor),
      isInstructor(actor),
      canCreateProgram(actor),
    ]);

    const asAdmin = adminArea && canCreateCatalog;
    const asInstructor = instructorArea && instructor && canCreate;
    if (!asAdmin && !asInstructor) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "Only Academy Admins or Instructors can create a course.",
      };
    }

    const supabase = await createClient();

    if (asAdmin) {
      const { data, error } = await supabase
        .from("academy_programs")
        .insert({
          name,
          type: "course",
          access: "free",
          recognition: "certificate_of_completion",
          learning_path: "business_and_practice",
          category: null,
          description: null,
          price: null,
          status: "draft",
          created_by_user_id: profile.user.id,
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return { ok: false, reason: "failed", message: "The course could not be created." };
      }

      return { ok: true, programId: (data as { id: string }).id, name };
    }

    const { data, error } = await supabase.rpc("academy_instructor_create_program", {
      p_name: name,
      p_type: "course",
      p_category: null,
      p_description: null,
      p_prerequisite_program_id: null,
      p_price: null,
    });

    if (error || typeof data !== "string") {
      return { ok: false, reason: "failed", message: "The course could not be created." };
    }

    return { ok: true, programId: data, name };
  } catch {
    return { ok: false, reason: "failed", message: "The course could not be created." };
  }
}
