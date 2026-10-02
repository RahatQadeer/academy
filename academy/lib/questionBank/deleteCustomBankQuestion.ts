import "server-only";

import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  isAcademyAdmin,
} from "@/academy/lib/authorization";
import { createClient } from "@/base/lib/supabase/server";
import type { DeleteCustomBankQuestionResult } from "./types";

export async function deleteCustomBankQuestion(
  questionIdRaw: string,
): Promise<DeleteCustomBankQuestionResult> {
  const questionId = questionIdRaw.trim().toLowerCase();
  if (!PROGRAM_ID.test(questionId)) {
    return { ok: false, reason: "invalid", message: "That question could not be found." };
  }

  const profile = await getSessionProfile();
  if (!profile) return { ok: false, reason: "unauthorized", message: "Sign in required." };

  const actor = { id: profile.user.id };
  const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
  if (!area || !admin) {
    return {
      ok: false,
      reason: "unauthorized",
      message: "Only an Academy Admin can delete questions saved for later.",
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_questions")
      .select("id, quiz_id")
      .eq("id", questionId)
      .maybeSingle();
    if (error) {
      return { ok: false, reason: "failed", message: "The question could not be deleted. Try again." };
    }
    const row = data as { id: string; quiz_id: string | null } | null;
    if (!row) {
      return { ok: false, reason: "invalid", message: "That question could not be found." };
    }
    if (row.quiz_id) {
      return {
        ok: false,
        reason: "invalid",
        message: "Questions already in a quiz are edited in the course, not deleted from Saved for later.",
      };
    }

    const { error: deleteError } = await supabase.from("academy_questions").delete().eq("id", questionId).is("quiz_id", null);
    if (deleteError) {
      return { ok: false, reason: "failed", message: "The question could not be deleted. Try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The question could not be deleted. Try again." };
  }
}
