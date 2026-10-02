import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, canCreateCatalogProgram } from "@/academy/lib/authorization";
import {
  DEFAULT_ACCESS_BY_TYPE,
  DEFAULT_LEARNING_PATH_BY_TYPE,
  DEFAULT_RECOGNITION_BY_TYPE,
  coerceAccess,
  coerceCredentialValidity,
  coerceLearningPath,
  coerceRecognitionForType,
  isRecognitionAllowedForType,
} from "@/academy/lib/courseMetadata";
import { isAcademyCourseAccess, isAcademyCourseRecognition, isAcademyLearningPath } from "@/academy/lib/domain";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  parsePrice,
  parseProgramType,
  trimText,
  validateProgramName,
} from "@/academy/instructor/programs/utils/validation";
import { validateProgramTagIds } from "@/academy/lib/courseTags/constants";
import { setProgramTags } from "@/academy/lib/courseTags/services";
import type { CreateAdminProgramInput, CreateAdminProgramResult } from "../actions";

export async function createAdminProgram(
  input: CreateAdminProgramInput,
): Promise<CreateAdminProgramResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };

    const actor = { id: profile.user.id };
    const [area, canCreate] = await Promise.all([
      canAccessAdminArea(actor),
      canCreateCatalogProgram(actor),
    ]);
    if (!area || !canCreate) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "Academy Admins create programs. Super Admin manages people and access.",
      };
    }

    const name = validateProgramName(input.name);
    const type = parseProgramType(input.type);
    const price = parsePrice(input.price);
    const tagError = validateProgramTagIds(input.tagIds ?? []);
    if (!name || !type || !price.ok) {
      return { ok: false, reason: "invalid", message: "Check the program details and try again." };
    }
    if (tagError) {
      return { ok: false, reason: "invalid", message: tagError };
    }

    const access = coerceAccess(input.access, type);
    const recognitionRaw = input.recognition?.trim();
    if (
      recognitionRaw &&
      isAcademyCourseRecognition(recognitionRaw) &&
      !isRecognitionAllowedForType(type, recognitionRaw)
    ) {
      return {
        ok: false,
        reason: "invalid",
        message: "Recognition does not match the selected course type.",
      };
    }
    const recognition = coerceRecognitionForType(type, recognitionRaw);
    const learningPath = coerceLearningPath(input.learningPath, type);
    const credentialValidity = coerceCredentialValidity(
      input.credentialValidity,
      type,
      recognition,
    );

    if (!isAcademyCourseAccess(access) || !isAcademyLearningPath(learningPath)) {
      return { ok: false, reason: "invalid", message: "Check access and learning path." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_programs")
      .insert({
        name,
        type,
        access,
        recognition,
        learning_path: learningPath,
        credential_validity: credentialValidity,
        category: trimText(input.category, CATEGORY_MAX) || null,
        description: trimText(input.description, DESCRIPTION_MAX) || null,
        price: price.value,
        status: "draft",
        created_by_user_id: profile.user.id,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return { ok: false, reason: "failed", message: "The draft could not be created." };
    }

    const programId = (data as { id: string }).id;
    const tags = await setProgramTags(programId, input.tagIds);
    if (!tags.ok) {
      return { ok: false, reason: "invalid", message: tags.message };
    }

    return { ok: true, programId };
  } catch {
    return { ok: false, reason: "failed", message: "The draft could not be created." };
  }
}

export function defaultMetadataForType(type: string) {
  const parsed = parseProgramType(type);
  if (!parsed) {
    return {
      access: DEFAULT_ACCESS_BY_TYPE.course,
      recognition: DEFAULT_RECOGNITION_BY_TYPE.course,
      learningPath: DEFAULT_LEARNING_PATH_BY_TYPE.course,
    };
  }
  return {
    access: DEFAULT_ACCESS_BY_TYPE[parsed],
    recognition: DEFAULT_RECOGNITION_BY_TYPE[parsed],
    learningPath: DEFAULT_LEARNING_PATH_BY_TYPE[parsed],
  };
}
