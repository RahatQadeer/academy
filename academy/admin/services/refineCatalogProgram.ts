import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { authorizeCatalogAuthor } from "./authorizeCatalogAuthor";
import type { RefineCatalogProgramResult, SaveAdminCatalogDraftInput, WhitbyRefineContext } from "../actions";
import { loadCatalogProgram } from "../catalog/services/loadCatalogProgram";
import {
  rewriteProgramDraft,
  type PersistedLesson,
  type PersistedModule,
  type PersistedProgramDraft,
} from "./catalogPersistence";
import { isRefinementDraftValid } from "./catalogQuality";
import { withIdempotency } from "./whitbyAgents/idempotency";
import { describePlanSteps } from "./whitbyAgents/planDiff";
import { stashPlan, takePlan, type PreviewDraft } from "./whitbyAgents/pendingPlans";
import { draftsMeaningfullyEqual, noChangeStyleSummary } from "./whitbyAgents/draftFingerprint";
import { classifyRisk } from "./whitbyAgents/risk";
import { logWorkflowTrace, runWhitbyWorkflow } from "./whitbyAgents/workflow";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { normalizeLegacyProgramType } from "@/academy/lib/courseMetadata";

function sanitizeTitle(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function sanitizeLessonType(value: unknown): PersistedLesson["type"] {
  if (
    value === "video" ||
    value === "attachment" ||
    value === "quiz" ||
    value === "scenario" ||
    value === "resource" ||
    value === "assignment"
  ) {
    return value;
  }
  return "reading";
}

export function normalizeRefineDraft(
  raw: Partial<PersistedProgramDraft & { summary: string }>,
  fallback: PersistedProgramDraft,
): (PersistedProgramDraft & { summary: string }) | null {
  const modules = Array.isArray(raw.modules) ? raw.modules : [];
  if (!raw.name && !fallback.name) return null;
  if (modules.length === 0) return null;

  return {
    name: sanitizeTitle(raw.name, fallback.name),
    description:
      typeof raw.description === "string" ? raw.description.trim() : fallback.description,
    category: typeof raw.category === "string" ? raw.category.trim() : fallback.category,
    type:
      raw.type &&
      [
        "short_course",
        "course",
        "certification_program",
        "endorsement_program",
      ].includes(String(raw.type))
        ? normalizeLegacyProgramType(String(raw.type))
        : normalizeLegacyProgramType(String(fallback.type)),
    summary:
      typeof raw.summary === "string" && raw.summary.trim()
        ? raw.summary.trim()
        : "Updated the program based on your instruction.",
    modules: modules
      .slice(0, 20)
      .map((module, moduleIndex) => {
        const item = module as Partial<PersistedModule & { lessons: PersistedLesson[] }>;
        const lessons = Array.isArray(item.lessons) ? item.lessons : [];
        const fallbackModule = fallback.modules[moduleIndex];
        return {
          title: sanitizeTitle(item.title, fallbackModule?.title ?? `Module ${moduleIndex + 1}`),
          lessons: lessons.slice(0, 16).map((lesson, lessonIndex) => {
            const lessonItem = lesson as Partial<PersistedLesson>;
            const fallbackLesson = fallbackModule?.lessons[lessonIndex];
            return {
              title: sanitizeTitle(
                lessonItem.title,
                fallbackLesson?.title ?? `Lesson ${lessonIndex + 1}`,
              ),
              type: sanitizeLessonType(lessonItem.type ?? fallbackLesson?.type),
              contentUrl:
                typeof lessonItem.contentUrl === "string"
                  ? lessonItem.contentUrl.trim()
                  : (fallbackLesson?.contentUrl ?? ""),
              contentBody:
                typeof lessonItem.contentBody === "string"
                  ? lessonItem.contentBody.trim()
                  : (fallbackLesson?.contentBody ?? ""),
              contentSummary:
                typeof lessonItem.contentSummary === "string"
                  ? lessonItem.contentSummary.trim()
                  : (fallbackLesson?.contentSummary ?? ""),
              learningObjectives: Array.isArray(lessonItem.learningObjectives)
                ? lessonItem.learningObjectives.map((entry) => String(entry)).filter(Boolean)
                : (fallbackLesson?.learningObjectives ?? []),
              videoUrl:
                typeof lessonItem.videoUrl === "string"
                  ? lessonItem.videoUrl.trim()
                  : (fallbackLesson?.videoUrl ?? ""),
              videoDurationSeconds: fallbackLesson?.videoDurationSeconds ?? 0,
              resources: Array.isArray(lessonItem.resources)
                ? lessonItem.resources.map((resource) => ({
                    title: sanitizeTitle(resource.title, "Resource"),
                    resourceType:
                      typeof resource.resourceType === "string" ? resource.resourceType : "link",
                    url: typeof resource.url === "string" ? resource.url : "",
                    notes: typeof resource.notes === "string" ? resource.notes : "",
                  }))
                : (fallbackLesson?.resources ?? []),
              assignment: lessonItem.assignment
                ? {
                    brief: lessonItem.assignment.brief ?? "",
                    submissionInstructions: lessonItem.assignment.submissionInstructions ?? "",
                    rubric: lessonItem.assignment.rubric ?? "",
                    estimatedMinutes: lessonItem.assignment.estimatedMinutes ?? "",
                  }
                : (fallbackLesson?.assignment ?? null),
              quiz: lessonItem.quiz
                ? {
                    passingScore: lessonItem.quiz.passingScore ?? "80",
                    questions: Array.isArray(lessonItem.quiz.questions)
                      ? lessonItem.quiz.questions.map((question) => ({
                          questionText: stripQuizAnswerLeaks(
                            sanitizeTitle(question.questionText, "New question"),
                          ),
                          type:
                            question.type === "true_false"
                              ? ("true_false" as const)
                              : ("multiple_choice" as const),
                          options: Array.isArray(question.options)
                            ? question.options.map((entry) => String(entry)).filter(Boolean)
                            : [],
                          correctAnswer:
                            typeof question.correctAnswer === "string"
                              ? question.correctAnswer
                              : "",
                        }))
                      : (fallbackLesson?.quiz?.questions ?? []),
                  }
                : (fallbackLesson?.quiz ?? null),
            };
          }),
        };
      })
      .filter((module) => module.lessons.length > 0),
  };
}

function draftInputToPersisted(input: SaveAdminCatalogDraftInput): PersistedProgramDraft {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    type: input.type,
    modules: input.modules.map((module) => ({
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        title: lesson.title,
        type: sanitizeLessonType(lesson.type),
        contentUrl: lesson.contentUrl,
        contentBody: lesson.contentBody,
        contentSummary: lesson.contentSummary,
        learningObjectives: lesson.learningObjectives,
        videoUrl: lesson.videoUrl,
        videoDurationSeconds: lesson.videoDurationSeconds ?? 0,
        resources: lesson.resources,
        assignment: lesson.assignment,
        quiz: lesson.quiz,
      })),
    })),
  };
}

async function rewriteWithWhitby(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext & { programStatus?: string },
): Promise<(PersistedProgramDraft & { summary: string; mutated?: boolean }) | null> {
  const started = Date.now();
  const outcome = await runWhitbyWorkflow(draft, instruction, context);
  logWorkflowTrace(outcome.trace);
  console.info(
    `[whitby] instruction="${instruction.slice(0, 80)}" status=${outcome.status} total=${Date.now() - started}ms mutated=${outcome.draft?.mutated !== false}`,
  );

  // Only a validated, committed change or an honest no-op is allowed through.
  // An aborted workflow (timeout, empty, or an invalid draft that failed
  // revision) returns null so the caller reports failure rather than saving.
  if (outcome.status === "aborted" || !outcome.draft) return null;

  const result = outcome.draft;
  if (result.mutated === false) return result;
  if (isRefinementDraftValid(result)) return result;
  return normalizeRefineDraft(result, draft);
}

function outlineOf(draft: { modules: PreviewDraft["modules"] }) {
  return draft.modules.map((module) => ({
    title: module.title,
    lessons: module.lessons.map((lesson) => ({
      title: lesson.title,
      type: lesson.type,
    })),
  }));
}

/** Commit a validated draft to the database. Shared by the auto-apply path and
 * the approval-apply path so both persist identically.
 * Published programs stage into unpublished_draft so learners keep the live version. */
async function persistProgramDraft(
  programId: string,
  rewritten: PreviewDraft,
  fallbackCategory: string,
  programStatus?: string,
): Promise<RefineCatalogProgramResult> {
  const supabase = await createClient();

  if (programStatus === "published") {
    const { data: live } = await supabase
      .from("academy_programs")
      .select("price, cover_image_url, prerequisite_program_id")
      .eq("id", programId)
      .maybeSingle();
    const liveRow = live as {
      price?: number | string | null;
      cover_image_url?: string | null;
      prerequisite_program_id?: string | null;
    } | null;
    const { UNPUBLISHED_DRAFT_VERSION } = await import("@/academy/lib/unpublishedDraft");
    const unpublishedDraft = {
      version: UNPUBLISHED_DRAFT_VERSION,
      name: rewritten.name,
      description: rewritten.description,
      category: rewritten.category || fallbackCategory || "",
      type: rewritten.type,
      price:
        liveRow?.price == null || liveRow.price === ""
          ? ""
          : String(Number(liveRow.price)),
      coverImageUrl: liveRow?.cover_image_url ?? "",
      prerequisiteProgramId: liveRow?.prerequisite_program_id ?? "",
      replaceStructure: true,
      modules: rewritten.modules,
    };
    const { error: draftError } = await supabase
      .from("academy_programs")
      .update({
        unpublished_draft: unpublishedDraft,
        unpublished_draft_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", programId)
      .eq("status", "published");

    if (draftError) {
      return {
        ok: false,
        reason: "failed",
        message: draftError.message.includes("unpublished_draft")
          ? "Apply migration 00041 so Whitby can stage edits on live programs."
          : "Whitby could not save unpublished edits.",
      };
    }

    const profile = await getSessionProfile();
    if (profile) {
      const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
      await writeProgramContentSnapshot({
        programId,
        actorUserId: profile.user.id,
        supabase,
      });
    }

    return {
      ok: true,
      mutated: true,
      programName: rewritten.name,
      summary: `${rewritten.summary} Saved as unpublished edits — learners still see the live course until you publish changes.`,
      modules: outlineOf(rewritten),
    };
  }

  const { error: programError } = await supabase
    .from("academy_programs")
    .update({
      name: rewritten.name,
      description: rewritten.description,
      category: rewritten.category || fallbackCategory || null,
      type: rewritten.type,
      updated_at: new Date().toISOString(),
    })
    .eq("id", programId);

  if (programError) {
    return { ok: false, reason: "failed", message: "The program draft could not be updated." };
  }

  const persisted = await rewriteProgramDraft(supabase, programId, rewritten);
  if (!persisted.ok) {
    return { ok: false, reason: "failed", message: "Whitby could not save the revised draft." };
  }

  const profile = await getSessionProfile();
  if (profile) {
    const { writeProgramContentSnapshot } = await import("@/academy/lib/programContentSnapshot");
    await writeProgramContentSnapshot({
      programId,
      actorUserId: profile.user.id,
      supabase,
    });
  }

  return {
    ok: true,
    mutated: true,
    programName: rewritten.name,
    summary: rewritten.summary,
    modules: outlineOf(rewritten),
  };
}

function aiErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Whitby could not apply that instruction.";
  if (error.message.includes("Missing DEEPSEEK_API_KEY")) {
    return "Whitby is not configured. Add DEEPSEEK_API_KEY to .env.local.";
  }
  if (error.message.includes("timed out")) {
    return "That took too long, so I stopped. Try a shorter instruction, like adding a quiz or editing one lesson.";
  }
  if (error.message.includes("DeepSeek request failed")) {
    return "Whitby could not reach DeepSeek. Check your API key and try again.";
  }
  return "Whitby could not apply that instruction.";
}

export async function refineCatalogProgram(
  programId: string,
  instruction: string,
  options?: {
    context?: WhitbyRefineContext;
    draft?: SaveAdminCatalogDraftInput;
    /** Stable id for this user gesture; a repeat returns the same result. */
    actionId?: string;
    /** Token from an earlier preview; applies that exact plan without re-running the agents. */
    confirmToken?: string;
    /** Sealed plan payload from the preview — required when Apply hits another serverless instance. */
    confirmPayload?: string;
  },
): Promise<RefineCatalogProgramResult> {
  try {
    const auth = await authorizeCatalogAuthor(programId);
    if (!auth.ok) return { ok: false, reason: "unauthorized" };
    const profile = { user: { id: auth.userId } };

    // Instructors may stage Whitby edits on published programs (unpublished_draft).
    // Applying live still requires admin approval / can_publish outside this path.

    // Approval-apply path: commit the exact draft the instructor previewed.
    if (options?.confirmToken) {
      const token = options.confirmToken;
      return withIdempotency(
        `apply:${token}`,
        async () => {
          const pending = takePlan(token, programId, profile.user.id, options.confirmPayload);
          if (!pending) {
            return {
              ok: false,
              reason: "failed",
              message: "That preview expired. Ask me again and I'll show a fresh plan to apply.",
            };
          }
          const { data: statusRow } = await (await createClient())
            .from("academy_programs")
            .select("status")
            .eq("id", programId)
            .maybeSingle();
          const status = (statusRow as { status?: string } | null)?.status;
          return persistProgramDraft(
            programId,
            pending.draft,
            pending.fallbackCategory,
            status,
          );
        },
        (result) => result.ok === true,
      );
    }

    const message = instruction.trim();
    if (!message) {
      return { ok: false, reason: "invalid", message: "Add an instruction for Whitby." };
    }

    let sourceDraft: PersistedProgramDraft;
    let fallbackCategory = "";
    let programStatus = "";

    if (options?.draft && options.draft.programId === programId) {
      sourceDraft = draftInputToPersisted(options.draft);
      const current = await loadCatalogProgram(programId);
      if (!current.ok) {
        return { ok: false, reason: "failed", message: "The current draft could not be loaded." };
      }
      fallbackCategory = current.program.category;
      programStatus = current.program.status;
    } else {
      const current = await loadCatalogProgram(programId);
      if (!current.ok) {
        return { ok: false, reason: "failed", message: "The current draft could not be loaded." };
      }
      fallbackCategory = current.program.category;
      programStatus = current.program.status;
      sourceDraft = {
        name: current.program.name,
        description: current.program.description,
        category: current.program.category,
        type: current.program.type,
        modules: current.program.modules.map((module) => ({
          title: module.title,
          lessons: module.lessons.map((lesson) => ({
            title: lesson.title,
            type: lesson.type,
            contentUrl: lesson.contentUrl,
            contentBody: lesson.contentBody,
            contentSummary: lesson.contentSummary,
            learningObjectives: lesson.learningObjectives,
            videoUrl: lesson.videoUrl,
            videoDurationSeconds: lesson.videoDurationSeconds ?? 0,
            resources: lesson.resources.map((resource) => ({
              title: resource.title,
              resourceType: resource.resourceType,
              url: resource.url,
              notes: resource.notes,
            })),
            assignment: lesson.assignment
              ? {
                  brief: lesson.assignment.brief,
                  submissionInstructions: lesson.assignment.submissionInstructions,
                  rubric: lesson.assignment.rubric,
                  estimatedMinutes: lesson.assignment.estimatedMinutes,
                }
              : null,
            quiz: lesson.quiz
              ? {
                  passingScore: lesson.quiz.passingScore,
                  questions: lesson.quiz.questions.map((question) => ({
                    questionText: stripQuizAnswerLeaks(question.questionText),
                    type: question.type,
                    options: question.options,
                    correctAnswer: question.correctAnswer,
                  })),
                }
              : null,
          })),
        })),
      };
    }

    // The compute + commit path, deduplicated by actionId so a retried gesture
    // (e.g. after a timed-out response) returns the first result instead of
    // mutating the draft twice. Only committed mutations are cached; chat
    // replies and failures always re-run.
    const run = async (): Promise<RefineCatalogProgramResult> => {
      const rewritten = await rewriteWithWhitby(sourceDraft, message, {
        ...options?.context,
        programStatus,
      });
      if (!rewritten) {
        return {
          ok: false,
          reason: "failed",
          message:
            "Whitby could not apply that instruction. Try adding a quiz, a video, or an assignment — or ask about the outline.",
        };
      }

      // A chat/answer or a no-op: nothing to apply or approve.
      if (rewritten.mutated === false) {
        return {
          ok: true,
          mutated: false,
          programName: rewritten.name,
          summary: rewritten.summary,
          modules: outlineOf(rewritten),
        };
      }

      // Model claimed an edit but the draft is identical after sanitize — never say Done.
      if (draftsMeaningfullyEqual(sourceDraft, rewritten)) {
        return {
          ok: true,
          mutated: false,
          programName: rewritten.name,
          summary: noChangeStyleSummary(message, rewritten.summary),
          modules: outlineOf(rewritten),
        };
      }

      if (!isRefinementDraftValid(rewritten)) {
        return {
          ok: false,
          reason: "failed",
          message:
            "Whitby could not apply that instruction. Try adding a quiz, a video, or an assignment — or ask about the outline.",
        };
      }

      // Risky change (delete / publish / bulk / restructure / edit published):
      // stash the fully-computed draft and return a plan for [Apply] / [Cancel]
      // instead of committing. The draft is NOT written until the token is
      // applied, so the outline stays as-is and returns the source outline.
      const risk = classifyRisk(message, { ...options?.context, programStatus });
      if (risk.requiresApproval) {
        const token = crypto.randomUUID();
        const steps = describePlanSteps(sourceDraft, rewritten);
        const stashed = stashPlan({
          token,
          programId,
          userId: profile.user.id,
          draft: rewritten,
          fallbackCategory,
          steps,
          risk,
        });
        return {
          ok: true,
          mutated: false,
          requiresApproval: true,
          pendingToken: stashed.token,
          pendingPayload: stashed.payload,
          risk: risk.level,
          plan: steps.length > 0 ? steps : [rewritten.summary],
          programName: rewritten.name,
          summary: "Here's the plan — review the changes below and apply them when you're ready.",
          modules: outlineOf(sourceDraft),
        };
      }

      // Low-risk: apply immediately.
      return persistProgramDraft(programId, rewritten, fallbackCategory, programStatus);
    };

    return withIdempotency(
      options?.actionId ? `refine:${programId}:${options.actionId}` : undefined,
      run,
      (result) => result.ok === true && (result.mutated === true || result.requiresApproval === true),
    );
  } catch (error) {
    console.error("[refineCatalogProgram]", error);
    return { ok: false, reason: "failed", message: aiErrorMessage(error) };
  }
}
