import "server-only";

import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAcademy, canAccessLearnerArea } from "@/academy/lib/authorization";
import { learnerCanAccessProgramContent } from "@/academy/lib/learnerProgramAccess";
import type { AcademyEntitlementSource } from "@/academy/lib/domain";
import type { MarkLessonCompleteResult } from "../types";
import { PROGRAM_ID } from "../utils/curriculum";
import { recalculateEnrollmentProgress } from "@/academy/progress/services/recalculateEnrollmentProgress";

export async function markLessonComplete(
  programId: string,
  lessonId: string,
): Promise<MarkLessonCompleteResult> {
  if (!isSupabaseConfigured()) return { status: "unavailable", reason: "failed" };
  if (!PROGRAM_ID.test(programId) || !PROGRAM_ID.test(lessonId)) {
    return { status: "unavailable", reason: "mismatch" };
  }

  const profile = await getSessionProfile();
  if (!profile) return { status: "unavailable", reason: "unauthenticated" };

  const user = { id: profile.user.id };
  if (!(await canAccessAcademy(user))) {
    return { status: "unavailable", reason: "no_academy_access" };
  }
  if (!(await canAccessLearnerArea(user))) {
    return { status: "unavailable", reason: "no_learner_capability" };
  }

  try {
    const supabase = await createClient();

    const { data: enrollment } = await supabase
      .from("academy_enrollments")
      .select("id, user_id, entitlement_source")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .maybeSingle();

    if (!enrollment || (enrollment as { user_id: string }).user_id !== user.id) {
      return { status: "unavailable", reason: "no_enrollment" };
    }

    const { data: program } = await supabase
      .from("academy_programs")
      .select("id, status, price, access")
      .eq("id", programId)
      .maybeSingle();
    if (!program || (program as { status: string }).status !== "published") {
      return { status: "unavailable", reason: "mismatch" };
    }

    const programRow = program as { price: number | null; access: string | null };
    const enrollmentRow = enrollment as {
      id: string;
      entitlement_source: AcademyEntitlementSource | null;
    };

    if (
      !learnerCanAccessProgramContent({
        price: programRow.price,
        entitlementSource: enrollmentRow.entitlement_source,
        enrolled: true,
        access: programRow.access,
      })
    ) {
      return { status: "unavailable", reason: "payment_required" };
    }

    const enrollmentId = enrollmentRow.id;

    const { data: lesson } = await supabase
      .from("academy_lessons")
      .select("id, module_id")
      .eq("id", lessonId)
      .maybeSingle();

    if (!lesson) return { status: "unavailable", reason: "mismatch" };

    const { data: module } = await supabase
      .from("academy_modules")
      .select("id, program_id")
      .eq("id", (lesson as { module_id: string }).module_id)
      .maybeSingle();

    if (!module || (module as { program_id: string }).program_id !== programId) {
      return { status: "unavailable", reason: "mismatch" };
    }

    const { data: existing } = await supabase
      .from("academy_lesson_progress")
      .select("id, status")
      .eq("enrollment_id", enrollmentId)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if ((existing as { status?: string } | null)?.status === "locked") {
      return { status: "unavailable", reason: "locked" };
    }
    if ((existing as { status?: string } | null)?.status === "completed") {
      await recalculateEnrollmentProgress(enrollmentId);
      return { status: "already_completed" };
    }

    const completedAt = new Date().toISOString();
    if (existing) {
      const { error } = await supabase
        .from("academy_lesson_progress")
        .update({ status: "completed", completed_at: completedAt })
        .eq("id", (existing as { id: string }).id)
        .eq("enrollment_id", enrollmentId);
      if (error) return { status: "unavailable", reason: "failed" };
    } else {
      const { error } = await supabase.from("academy_lesson_progress").insert({
        enrollment_id: enrollmentId,
        lesson_id: lessonId,
        status: "completed",
        completed_at: completedAt,
      });
      if (error?.code === "23505") {
        await recalculateEnrollmentProgress(enrollmentId);
        return { status: "already_completed" };
      }
      if (error) return { status: "unavailable", reason: "failed" };
    }

    await recalculateEnrollmentProgress(enrollmentId);
    return { status: "completed" };
  } catch {
    return { status: "unavailable", reason: "failed" };
  }
}
