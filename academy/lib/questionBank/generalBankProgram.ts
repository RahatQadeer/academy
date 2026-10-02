import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  canCreateProgram,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import {
  GENERAL_BANK_CATEGORY,
  GENERAL_BANK_PROGRAM_NAME,
  isGeneralBankProgram,
} from "./generalBankConstants";

export {
  GENERAL_BANK_CATEGORY,
  GENERAL_BANK_PROGRAM_NAME,
  isGeneralBankProgram,
} from "./generalBankConstants";

export type EnsureGeneralBankProgramResult =
  | { ok: true; programId: string; name: string }
  | {
      ok: false;
      reason: "unauthorized" | "failed";
      message: string;
    };

/**
 * One shared draft program that holds Custom / general bank questions.
 * Hidden from catalog & program lists via category marker.
 */
export async function ensureGeneralBankProgram(): Promise<EnsureGeneralBankProgramResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) {
      return { ok: false, reason: "unauthorized", message: "Sign in required." };
    }

    const actor = { id: profile.user.id };
    const [adminArea, admin, instructorArea, instructor, canCreate] = await Promise.all([
      canAccessAdminArea(actor),
      isAcademyAdmin(actor),
      canAccessInstructorArea(actor),
      isInstructor(actor),
      canCreateProgram(actor),
    ]);

    const asAdmin = adminArea && admin;
    const asInstructor = instructorArea && instructor && canCreate;
    if (!asAdmin && !asInstructor) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "Only Academy admins or instructors can add general questions.",
      };
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("academy_programs")
      .select("id, name")
      .eq("category", GENERAL_BANK_CATEGORY)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return {
        ok: true,
        programId: (existing as { id: string }).id,
        name: GENERAL_BANK_PROGRAM_NAME,
      };
    }

    // Prefer admin insert so we can set the hidden category marker.
    if (asAdmin) {
      const { data, error } = await supabase
        .from("academy_programs")
        .insert({
          name: GENERAL_BANK_PROGRAM_NAME,
          type: "course",
          access: "free",
          recognition: "none",
          learning_path: "business_and_practice",
          category: GENERAL_BANK_CATEGORY,
          description: "Shared question-bank pool. Not shown in the course catalog.",
          price: null,
          status: "draft",
          created_by_user_id: profile.user.id,
        })
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return { ok: false, reason: "failed", message: "The general question pool could not be created." };
      }
      return { ok: true, programId: (data as { id: string }).id, name: GENERAL_BANK_PROGRAM_NAME };
    }

    // Instructor path: RPC may not accept category — create then stamp category.
    const { data: createdId, error: createError } = await supabase.rpc(
      "academy_instructor_create_program",
      {
        p_name: GENERAL_BANK_PROGRAM_NAME,
        p_type: "course",
        p_category: GENERAL_BANK_CATEGORY,
        p_description: "Shared question-bank pool. Not shown in the course catalog.",
        p_prerequisite_program_id: null,
        p_price: null,
      },
    );

    if (createError || typeof createdId !== "string") {
      return { ok: false, reason: "failed", message: "The general question pool could not be created." };
    }

    await supabase
      .from("academy_programs")
      .update({
        category: GENERAL_BANK_CATEGORY,
        name: GENERAL_BANK_PROGRAM_NAME,
        recognition: "none",
      })
      .eq("id", createdId);

    return { ok: true, programId: createdId, name: GENERAL_BANK_PROGRAM_NAME };
  } catch {
    return { ok: false, reason: "failed", message: "The general question pool could not be created." };
  }
}
