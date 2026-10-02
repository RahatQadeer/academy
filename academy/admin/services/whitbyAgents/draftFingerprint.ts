import "server-only";

import { sanitizeLessonMarkdown } from "@/academy/admin/catalog/lib/lessonContentText";
import type { PersistedLesson, PersistedProgramDraft } from "../catalogPersistence";

/**
 * Stable snapshot of what instructors see in the builder.
 * Used to refuse false "Done" when the model returns an identical lesson.
 */
export function lessonFingerprint(lesson: PersistedLesson): string {
  return JSON.stringify({
    title: lesson.title.trim(),
    type: lesson.type,
    contentBody: sanitizeLessonMarkdown(lesson.contentBody || "").trim(),
    contentSummary: (lesson.contentSummary || "").trim(),
    learningObjectives: (lesson.learningObjectives || []).map((item) => String(item).trim()).filter(Boolean),
    videoUrl: (lesson.videoUrl || "").trim(),
    contentUrl: (lesson.contentUrl || "").trim(),
    resources: (lesson.resources || []).map((resource) => ({
      title: resource.title || "",
      resourceType: resource.resourceType || "",
      url: resource.url || "",
      notes: resource.notes || "",
    })),
    assignment: lesson.assignment
      ? {
          brief: lesson.assignment.brief || "",
          submissionInstructions: lesson.assignment.submissionInstructions || "",
          rubric: lesson.assignment.rubric || "",
          estimatedMinutes: lesson.assignment.estimatedMinutes || "",
        }
      : null,
    quiz: lesson.quiz
      ? {
          passingScore: lesson.quiz.passingScore || "",
          questions: (lesson.quiz.questions || []).map((question) => ({
            questionText: question.questionText || "",
            type: question.type,
            options: question.options || [],
            correctAnswer: question.correctAnswer || "",
          })),
        }
      : null,
  });
}

export function programFingerprint(draft: PersistedProgramDraft): string {
  return JSON.stringify({
    name: (draft.name || "").trim(),
    description: (draft.description || "").trim(),
    category: (draft.category || "").trim(),
    type: draft.type,
    modules: (draft.modules || []).map((module) => ({
      title: (module.title || "").trim(),
      lessons: (module.lessons || []).map(lessonFingerprint),
    })),
  });
}

export function draftsMeaningfullyEqual(
  before: PersistedProgramDraft,
  after: PersistedProgramDraft,
): boolean {
  return programFingerprint(before) === programFingerprint(after);
}

/** Honest chat when a style/beautify ask did not change saved content. */
export function noChangeStyleSummary(instruction: string, modelSummary?: string): string {
  const styleAsk =
    /\b(beautif|prettier|style|format|definition|scenario|card|ui|polish|professional|nicer)\b/i.test(
      instruction,
    );
  if (styleAsk) {
    return "I checked the selected lesson — the saved content already matches that structure, so nothing was rewritten. Open the lesson Preview toggle to see Definition / Scenario cards. If a block still looks plain, name the term (e.g. JDK) and I’ll fix that block.";
  }
  const trimmed = modelSummary?.trim();
  if (trimmed && !/^done\b/i.test(trimmed)) {
    return `${trimmed} (No course fields changed after verification.)`;
  }
  return "I reviewed that request against the current draft — nothing needed to change, so I left the course as-is.";
}
