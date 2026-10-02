import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { authorizeCatalogAuthor } from "./authorizeCatalogAuthor";
import { parseProgramType, parsePrice, parsePrerequisite, validateProgramName } from "@/academy/instructor/programs/utils/validation";
import {
  coerceAccess,
  coerceCredentialValidity,
  coerceLearningPath,
  coerceRecognitionForType,
  isRecognitionAllowedForType,
} from "@/academy/lib/courseMetadata";
import { isAcademyCourseRecognition } from "@/academy/lib/domain";
import { validateProgramTagIds } from "@/academy/lib/courseTags/constants";
import { setProgramTags } from "@/academy/lib/courseTags/services";
import type { SaveAdminCatalogDraftInput, SaveAdminCatalogDraftResult } from "../actions";
import { rewriteProgramDraft, syncProgramDraft, type PersistedProgramDraft } from "./catalogPersistence";
import { parsePassingScorePercent } from "@/academy/lib/scorePercent";

export async function saveAdminCatalogDraft(
  input: SaveAdminCatalogDraftInput,
): Promise<SaveAdminCatalogDraftResult> {
  try {
    const auth = await authorizeCatalogAuthor(input.programId);
    if (!auth.ok) return { ok: false, reason: "unauthorized" };

    const name = validateProgramName(input.name);
    const type = parseProgramType(input.type);
    const price = parsePrice(input.price);
    const prerequisite = parsePrerequisite(input.prerequisiteProgramId ?? "", input.programId);
    if (!name || !type || !price.ok || prerequisite === false) {
      return {
        ok: false,
        reason: "invalid",
        message: !price.ok
          ? "Enter a valid price (leave blank for free programs)."
          : prerequisite === false
            ? "Choose a valid prerequisite program."
            : "Program title and type are required.",
      };
    }

    const access = coerceAccess(input.access, type);
    if (input.tagIds !== undefined) {
      const tagError = validateProgramTagIds(input.tagIds);
      if (tagError) {
        return { ok: false, reason: "invalid", message: tagError };
      }
    }
    if (
      input.recognition &&
      isAcademyCourseRecognition(input.recognition) &&
      !isRecognitionAllowedForType(type, input.recognition)
    ) {
      return {
        ok: false,
        reason: "invalid",
        message: "Recognition does not match the selected course type.",
      };
    }
    const recognition = coerceRecognitionForType(type, input.recognition);
    const learningPath = coerceLearningPath(input.learningPath, type);
    const credentialValidity = coerceCredentialValidity(
      input.credentialValidity,
      type,
      recognition,
    );

    const supabase = await createClient();
    const { data: currentRow } = await supabase
      .from("academy_programs")
      .select("status, unpublished_draft")
      .eq("id", input.programId)
      .maybeSingle();
    const currentStatus = (currentRow as { status?: string } | null)?.status;
    const isPublished = currentStatus === "published";

    if (!auth.isAdmin && isPublished) {
      // Instructors may stage edits on live programs; applying still needs approval / can_publish.
    }

    const persisted: PersistedProgramDraft = {
      name,
      description: input.description.trim(),
      category: input.category.trim(),
      type,
      modules: input.modules.map((module) => ({
        id: module.id,
        title: module.title.trim() || "Untitled module",
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title.trim() || "Untitled lesson",
          type:
            lesson.type === "video" ||
            lesson.type === "attachment" ||
            lesson.type === "quiz" ||
            lesson.type === "scenario" ||
            lesson.type === "resource" ||
            lesson.type === "assignment"
              ? lesson.type
              : "reading",
          contentUrl: lesson.contentUrl.trim(),
          contentBody: lesson.contentBody.trim(),
          contentSummary: lesson.contentSummary.trim(),
          learningObjectives: lesson.learningObjectives.map((item) => item.trim()).filter(Boolean),
          videoUrl: lesson.videoUrl.trim(),
          videoDurationSeconds: lesson.videoDurationSeconds ?? 0,
          resources: lesson.resources.map((resource) => ({
            title: resource.title.trim() || "Resource",
            resourceType: resource.resourceType.trim() || "link",
            url: resource.url.trim(),
            notes: resource.notes.trim(),
          })),
          assignment: lesson.assignment
            ? {
                brief: lesson.assignment.brief.trim(),
                submissionInstructions: lesson.assignment.submissionInstructions.trim(),
                rubric: lesson.assignment.rubric.trim(),
                estimatedMinutes: lesson.assignment.estimatedMinutes.trim(),
              }
            : null,
          quiz: lesson.quiz
            ? {
                passingScore: String(parsePassingScorePercent(lesson.quiz.passingScore)),
                questions: lesson.quiz.questions.map((question) => ({
                  questionText: question.questionText.trim() || "New question",
                  type: question.type,
                  options: question.options.map((option) => option.trim()).filter(Boolean),
                  correctAnswer: question.correctAnswer.trim(),
                })),
              }
            : null,
        })),
      })),
    };

    if (isPublished) {
      const { UNPUBLISHED_DRAFT_VERSION } = await import("@/academy/lib/unpublishedDraft");
      const unpublishedDraft = {
        version: UNPUBLISHED_DRAFT_VERSION,
        name,
        description: input.description.trim(),
        category: input.category.trim(),
        type,
        access,
        recognition,
        learningPath,
        credentialValidity,
        price: input.price.trim(),
        coverImageUrl: input.coverImageUrl.trim(),
        prerequisiteProgramId: typeof prerequisite === "string" ? prerequisite : "",
        replaceStructure: Boolean(input.replaceStructure),
        tagIds: input.tagIds,
        modules: persisted.modules,
      };
      // Stage curriculum in unpublished_draft, but write recognition / type / validity
      // live immediately so certificates resolve to the correct sheet without republish.
      const { error: draftError } = await supabase
        .from("academy_programs")
        .update({
          unpublished_draft: unpublishedDraft,
          unpublished_draft_updated_at: new Date().toISOString(),
          name,
          description: input.description.trim() || null,
          category: input.category.trim() || null,
          type,
          access,
          recognition,
          learning_path: learningPath,
          credential_validity: credentialValidity,
          price: price.value,
          cover_image_url: input.coverImageUrl.trim() || null,
          prerequisite_program_id: typeof prerequisite === "string" ? prerequisite : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.programId)
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

      // Keep in-flight credentials aligned with the live recognition.
      try {
        await supabase.rpc("academy_sync_program_credential_types", {
          p_program_id: input.programId,
        });
      } catch {
        /* RPC available after migration 00057 */
      }

      const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
      if (input.tagIds !== undefined) {
        const tags = await setProgramTags(input.programId, input.tagIds);
        if (!tags.ok) {
          return { ok: false, reason: "invalid", message: tags.message };
        }
      }

      await writeProgramContentSnapshot({
        programId: input.programId,
        actorUserId: auth.userId,
        supabase,
      });

      return { ok: true };
    }

    let update = supabase
      .from("academy_programs")
      .update({
        name,
        description: input.description.trim() || null,
        category: input.category.trim() || null,
        type,
        access,
        recognition,
        learning_path: learningPath,
        credential_validity: credentialValidity,
        price: price.value,
        cover_image_url: input.coverImageUrl.trim() || null,
        prerequisite_program_id: typeof prerequisite === "string" ? prerequisite : null,
      })
      .eq("id", input.programId);
    if (!auth.isAdmin) update = update.neq("status", "published");
    const { error: updateError } = await update;

    if (updateError) {
      return { ok: false, reason: "failed", message: "The draft could not be updated." };
    }

    // Whitby rewrite mints new module/lesson IDs. Undo must recreate the
    // previous outline instead of trying to update rows that no longer exist.
    const persist = input.replaceStructure
      ? await rewriteProgramDraft(supabase, input.programId, persisted)
      : await syncProgramDraft(supabase, input.programId, persisted);

    if (!persist.ok) {
      return { ok: false, reason: "failed", message: "The draft content could not be saved." };
    }

    if (input.tagIds !== undefined) {
      const tags = await setProgramTags(input.programId, input.tagIds);
      if (!tags.ok) {
        return { ok: false, reason: "invalid", message: tags.message };
      }
    }

    const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
    await writeProgramContentSnapshot({
      programId: input.programId,
      actorUserId: auth.userId,
      supabase,
    });

    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The draft content could not be saved." };
  }
}
