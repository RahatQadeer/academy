import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { canAuthorProgram } from "@/academy/lib/authorization";
import { getSessionProfile } from "@/base/identity/session";
import { syncProgramDraft } from "@/academy/admin/services/catalogPersistence";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { parsePassingScorePercent } from "@/academy/lib/scorePercent";
import type { SaveProgramDraftInput, SaveProgramDraftResult } from "../types";
import { loadInstructorAssignmentScope } from "./loadInstructorAssignmentScope";
import { loadProgramEditor } from "./loadProgramEditor";
import {
  CATEGORY_MAX,
  DESCRIPTION_MAX,
  PROGRAM_ID,
  TITLE_MAX,
  parseLessonType,
  parsePrerequisite,
  parsePrice,
  parseProgramType,
  sanitizeContentUrl,
  trimText,
  validateProgramName,
} from "../utils/validation";
import {
  coerceAccess,
  coerceCredentialValidity,
  coerceLearningPath,
  coerceRecognitionForType,
} from "@/academy/lib/courseMetadata";
import { validateProgramTagIds } from "@/academy/lib/courseTags/constants";
import { setProgramTags } from "@/academy/lib/courseTags/services";

function moduleAllowed(moduleId: string | null, allowedModuleIds: Set<string> | null) {
  if (!allowedModuleIds) return true;
  if (!moduleId) return true;
  return allowedModuleIds.has(moduleId);
}

export async function saveProgramDraft(
  input: SaveProgramDraftInput,
): Promise<SaveProgramDraftResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    const userId = profile.user.id;
    const programId = input.programId.trim().toLowerCase();
    if (!PROGRAM_ID.test(programId)) return { ok: false, reason: "invalid" };

    const [allowed, assignmentScope] = await Promise.all([
      canAuthorProgram({ id: userId }, programId),
      loadInstructorAssignmentScope(userId, programId),
    ]);
    if (!allowed) return { ok: false, reason: "unauthorized" };

    const allowedModuleIds =
      assignmentScope && assignmentScope.moduleIds.length > 0
        ? new Set(assignmentScope.moduleIds)
        : null;

    const name = validateProgramName(input.name);
    const type = parseProgramType(input.type);
    const price = parsePrice(input.price);
    const prerequisite = parsePrerequisite(input.prerequisiteProgramId, programId);
    if (!name || !type || !price.ok || prerequisite === false) {
      return { ok: false, reason: "invalid", message: "Check the program details and try again." };
    }
    if (input.tagIds !== undefined) {
      const tagError = validateProgramTagIds(input.tagIds);
      if (tagError) {
        return { ok: false, reason: "invalid", message: tagError };
      }
    }
    if (input.modules.length > 100) {
      return { ok: false, reason: "invalid", message: "Too many modules." };
    }

    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase
      .from("academy_programs")
      .select("id, status, created_by_user_id, cover_image_url")
      .eq("id", programId)
      .maybeSingle();

    if (currentError) return { ok: false, reason: "failed" };
    if (!current) return { ok: false, reason: "unauthorized" };
    const status = (current as { status?: string }).status;
    const isPublished = status === "published";

    const programPatch: Record<string, unknown> = {};
    if (!allowedModuleIds) {
      programPatch.name = name;
      programPatch.type = type;
      programPatch.access = coerceAccess(input.access, type);
      programPatch.recognition = coerceRecognitionForType(type, input.recognition);
      programPatch.learning_path = coerceLearningPath(input.learningPath, type);
      programPatch.credential_validity = coerceCredentialValidity(
        input.credentialValidity,
        type,
        programPatch.recognition as string,
      );
      programPatch.category = trimText(input.category, CATEGORY_MAX) || null;
      programPatch.description = trimText(input.description, DESCRIPTION_MAX) || null;
      programPatch.prerequisite_program_id = prerequisite;
      programPatch.price = price.value;
    }
    if (typeof input.coverImageUrl === "string" && !allowedModuleIds) {
      programPatch.cover_image_url = input.coverImageUrl.trim() || null;
    }

    // Build modules first (validation) before write.

    const persistedModules = [];
    for (let moduleIndex = 0; moduleIndex < input.modules.length; moduleIndex += 1) {
      const moduleInput = input.modules[moduleIndex];
      if (!moduleInput) continue;
      if (moduleInput.lessons.length > 80) {
        return { ok: false, reason: "invalid", message: "Too many lessons in a module." };
      }
      const title = trimText(moduleInput.title, TITLE_MAX);
      if (!title) {
        return { ok: false, reason: "invalid", message: "Every module needs a title." };
      }

      const moduleId = moduleInput.id && PROGRAM_ID.test(moduleInput.id) ? moduleInput.id : null;
      if (moduleId && !moduleAllowed(moduleId, allowedModuleIds)) {
        return {
          ok: false,
          reason: "unauthorized",
          message: "You can only edit modules assigned to you.",
        };
      }
      if (!moduleId && allowedModuleIds) {
        return {
          ok: false,
          reason: "unauthorized",
          message: "You cannot add modules outside your assigned scope.",
        };
      }

      const lessons = [];
      for (const lessonInput of moduleInput.lessons) {
        if (!lessonInput) continue;
        const lessonTitle = trimText(lessonInput.title, TITLE_MAX);
        const lessonType = parseLessonType(lessonInput.type);
        const contentUrl = sanitizeContentUrl(lessonInput.contentUrl);
        if (!lessonTitle || !lessonType || contentUrl === false) {
          return { ok: false, reason: "invalid", message: "Check each lesson and try again." };
        }

        const quiz = lessonInput.quiz
          ? {
              passingScore: String(parsePassingScorePercent(lessonInput.quiz.passingScore)),
              questions: lessonInput.quiz.questions.map((question) => ({
                questionText: stripQuizAnswerLeaks(question.questionText) || "New question",
                type: question.type,
                options: question.options.map((option) => option.trim()).filter(Boolean),
                correctAnswer: question.correctAnswer.trim(),
                fromBank: question.fromBank,
              })),
            }
          : lessonType === "quiz"
            ? { passingScore: "80", questions: [] }
            : null;

        lessons.push({
          id: lessonInput.id && PROGRAM_ID.test(lessonInput.id) ? lessonInput.id : undefined,
          title: lessonTitle,
          type: lessonType,
          contentUrl: contentUrl ?? "",
          contentBody: (lessonInput.contentBody ?? "").trim(),
          contentSummary: (lessonInput.contentSummary ?? "").trim(),
          learningObjectives: (lessonInput.learningObjectives ?? [])
            .map((item) => item.trim())
            .filter(Boolean),
          videoUrl: (lessonInput.videoUrl ?? "").trim(),
          videoDurationSeconds: lessonInput.videoDurationSeconds ?? 0,
          resources: (lessonInput.resources ?? []).map((resource) => ({
            title: resource.title.trim() || "Resource",
            resourceType: resource.resourceType.trim() || "link",
            url: resource.url.trim(),
            notes: resource.notes.trim(),
          })),
          assignment: lessonInput.assignment
            ? {
                brief: lessonInput.assignment.brief.trim(),
                submissionInstructions: lessonInput.assignment.submissionInstructions.trim(),
                rubric: lessonInput.assignment.rubric.trim(),
                estimatedMinutes: lessonInput.assignment.estimatedMinutes.trim(),
              }
            : null,
          quiz,
        });
      }

      persistedModules.push({
        id: moduleId ?? undefined,
        title,
        lessons,
      });
    }

    if (isPublished) {
      const { UNPUBLISHED_DRAFT_VERSION } = await import("@/academy/lib/unpublishedDraft");
      const cover =
        typeof input.coverImageUrl === "string"
          ? input.coverImageUrl.trim()
          : ((current as { cover_image_url?: string | null }).cover_image_url ?? "");
      const unpublishedDraft = {
        version: UNPUBLISHED_DRAFT_VERSION,
        name,
        description: trimText(input.description, DESCRIPTION_MAX),
        category: trimText(input.category, CATEGORY_MAX),
        type,
        access: coerceAccess(input.access, type),
        recognition: coerceRecognitionForType(type, input.recognition),
        learningPath: coerceLearningPath(input.learningPath, type),
        credentialValidity: coerceCredentialValidity(
          input.credentialValidity,
          type,
          input.recognition,
        ),
        price: input.price?.trim?.() ?? "",
        coverImageUrl: cover,
        prerequisiteProgramId: typeof prerequisite === "string" ? prerequisite : "",
        tagIds: input.tagIds,
        modules: persistedModules,
      };
      const liveRecognition = coerceRecognitionForType(type, input.recognition);
      const liveAccess = coerceAccess(input.access, type);
      const livePath = coerceLearningPath(input.learningPath, type);
      const liveValidity = coerceCredentialValidity(
        input.credentialValidity,
        type,
        liveRecognition,
      );
      const { error: draftError } = await supabase
        .from("academy_programs")
        .update({
          unpublished_draft: unpublishedDraft,
          unpublished_draft_updated_at: new Date().toISOString(),
          ...(allowedModuleIds
            ? {}
            : {
                name,
                description: trimText(input.description, DESCRIPTION_MAX) || null,
                category: trimText(input.category, CATEGORY_MAX) || null,
                type,
                access: liveAccess,
                recognition: liveRecognition,
                learning_path: livePath,
                credential_validity: liveValidity,
                price: price.value,
                prerequisite_program_id: typeof prerequisite === "string" ? prerequisite : null,
              }),
          updated_at: new Date().toISOString(),
        })
        .eq("id", programId)
        .eq("status", "published");
      if (draftError) {
        return {
          ok: false,
          reason: "failed",
          message: draftError.message.includes("unpublished_draft")
            ? "Apply migration 00041 so unpublished edits can be saved."
            : "The unpublished edits could not be saved.",
        };
      }

      if (!allowedModuleIds) {
        try {
          await supabase.rpc("academy_sync_program_credential_types", {
            p_program_id: programId,
          });
        } catch {
          /* RPC available after migration 00057 */
        }
      }

      // Withdraw unused approval for republish, but keep program published.
      await withdrawApprovalIfNeeded(supabase, programId, profile.user.id, { keepPublished: true });

      if (input.tagIds !== undefined && !allowedModuleIds) {
        const tags = await setProgramTags(programId, input.tagIds);
        if (!tags.ok) {
          return { ok: false, reason: "invalid", message: tags.message };
        }
      }

      const reloaded = await loadProgramEditor(userId, programId, { skipAccessCheck: true });
      if (!reloaded.ok) return { ok: false, reason: "failed" };
      return { ok: true, data: reloaded.data, approvalWithdrawn: false };
    }

    if (Object.keys(programPatch).length > 0) {
      const { error: updateError } = await supabase
        .from("academy_programs")
        .update(programPatch)
        .eq("id", programId)
        .neq("status", "published");
      if (updateError) return { ok: false, reason: "failed" };
    }

    const synced = await syncProgramDraft(
      supabase,
      programId,
      {
        name,
        description: trimText(input.description, DESCRIPTION_MAX),
        category: trimText(input.category, CATEGORY_MAX),
        type,
        modules: persistedModules,
      },
      { prune: !allowedModuleIds },
    );
    if (!synced.ok) {
      return { ok: false, reason: "failed", message: "The draft content could not be saved." };
    }

    if (input.tagIds !== undefined && !allowedModuleIds) {
      const tags = await setProgramTags(programId, input.tagIds);
      if (!tags.ok) {
        return { ok: false, reason: "invalid", message: tags.message };
      }
    }

    const approvalWithdrawn = await withdrawApprovalIfNeeded(supabase, programId, profile.user.id);

    const reloaded = await loadProgramEditor(userId, programId, { skipAccessCheck: true });
    if (!reloaded.ok) return { ok: false, reason: "failed" };
    return { ok: true, data: reloaded.data, approvalWithdrawn };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

type DraftClient = { from: (table: string) => any };

async function withdrawApprovalIfNeeded(
  supabase: DraftClient,
  programId: string,
  actorUserId: string,
  options?: { keepPublished?: boolean },
) {
  const { data: approved } = await supabase
    .from("academy_publish_requests")
    .select("id")
    .eq("program_id", programId)
    .eq("status", "approved")
    .is("published_at", null)
    .limit(1);

  if (!approved || approved.length === 0) return false;

  await supabase
    .from("academy_publish_requests")
    .update({
      status: "rejected",
      notes: "Content changed after approval. Submit again for review.",
      reviewed_at: new Date().toISOString(),
    })
    .eq("program_id", programId)
    .eq("status", "approved")
    .is("published_at", null);

  if (!options?.keepPublished) {
    await supabase
      .from("academy_programs")
      .update({ status: "draft" })
      .eq("id", programId)
      .neq("status", "published");
  }

  const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
  await writeProgramContentSnapshot({
    programId,
    actorUserId,
    supabase,
  });

  return true;
}
