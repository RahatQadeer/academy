import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import {
  canAccessInstructorArea,
  canCreateProgram,
  isInstructor,
} from "@/academy/lib/authorization";
import { getSessionProfile } from "@/base/identity/session";
import type { CreateProgramInput, CreateProgramResult } from "../types";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  parsePrerequisite,
  parsePrice,
  parseProgramType,
  trimText,
  validateProgramName,
} from "../utils/validation";
import { validateProgramTagIds } from "@/academy/lib/courseTags/constants";
import { setProgramTags } from "@/academy/lib/courseTags/services";
import { checkTempInstructorCourseQuota } from "@/academy/lib/tempInstructorQuota";

export async function createProgram(input: CreateProgramInput): Promise<CreateProgramResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const actor = { id: profile.user.id };
    const [area, instructor, allowed] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
      canCreateProgram(actor),
    ]);
    if (!area || !instructor || !allowed) return { ok: false, reason: "unauthorized" };

    // TEMPORARY — Brent helper account course cap.
    const quota = await checkTempInstructorCourseQuota({
      userId: profile.user.id,
      email: profile.user.email,
    });
    if (quota.limited && !quota.allowed) {
      return { ok: false, reason: "invalid", message: quota.message };
    }

    const name = validateProgramName(input.name);
    const type = parseProgramType(input.type);
    const price = parsePrice(input.price);
    const prerequisite = parsePrerequisite(input.prerequisiteProgramId);
    const tagError = validateProgramTagIds(input.tagIds ?? []);
    if (!name || !type || !price.ok || prerequisite === false) {
      return { ok: false, reason: "invalid" };
    }
    if (tagError) {
      return { ok: false, reason: "invalid", message: tagError };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("academy_instructor_create_program", {
      p_name: name,
      p_type: type,
      p_category: trimText(input.category, CATEGORY_MAX) || null,
      p_description: trimText(input.description, DESCRIPTION_MAX) || null,
      p_prerequisite_program_id: prerequisite,
      p_price: price.value,
    });

    if (error || typeof data !== "string") return { ok: false, reason: "failed" };

    const tags = await setProgramTags(data, input.tagIds);
    if (!tags.ok) {
      return { ok: false, reason: "invalid", message: tags.message };
    }

    return { ok: true, programId: data };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
