import "server-only";

import { AFTER_LESSON_RE, BEFORE_LESSON_RE, INSIDE_LESSON_RE } from "./coAuthorSystem";
import type { PersistedLesson, PersistedProgramDraft } from "../catalogPersistence";
import { generateLessonDraft } from "./content";
import { placeLessonsOp } from "./apply";
import { lessonLabel } from "./locator";
import type { WhitbyAgentResult, WhitbyPlan } from "./types";

function fallbackAssignment(lessonTitle: string, programName: string, moduleTitle: string) {
  return {
    brief: `Apply what you learned in “${lessonTitle}” (${moduleTitle} / ${programName}). Produce a professional work product a colleague could review.`,
    submissionInstructions:
      "Submit a written response covering your approach, evidence, and next step.",
    rubric: [
      "| Criteria | Excellent (3 pts) | Good (2 pts) | Needs work (1 pt) |",
      "| --- | --- | --- | --- |",
      `| Relevance to ${lessonTitle} | Clear use of the lesson ideas | Partial use | Little connection |`,
      "| Clarity | Precise and well structured | Mostly clear | Hard to follow |",
      "| Completeness | Meets the brief fully | Mostly complete | Incomplete |",
    ].join("\n"),
    estimatedMinutes: "25",
  };
}

function shouldAttachToLesson(plan: WhitbyPlan): boolean {
  if (plan.mode === "attach") return true;
  if (plan.mode === "insert") return false;
  if (plan.lessonIndex == null) return false;
  const notes = plan.notes;
  if (AFTER_LESSON_RE.test(notes) || BEFORE_LESSON_RE.test(notes)) return false;
  if (/\b(new|separate|another)\s+(assignment\s+)?lesson\b/i.test(notes)) return false;
  if (/\bnot (before|after)\b/i.test(notes)) return true;
  return INSIDE_LESSON_RE.test(notes);
}

export async function runAssignmentAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
): Promise<WhitbyAgentResult> {
  const moduleIndex = plan.moduleIndex ?? Math.max(0, draft.modules.length - 1);
  const module = draft.modules[moduleIndex];
  if (!module) {
    return { ops: [], summary: "No module is available for an assignment yet.", agent: "assignment" };
  }

  if (shouldAttachToLesson(plan) && plan.lessonIndex != null) {
    const existing = module.lessons[plan.lessonIndex];
    if (!existing) {
      return {
        ops: [],
        summary: `I couldn’t find lesson ${moduleIndex + 1}.${plan.lessonIndex + 1}. Pick it in the outline or name it again.`,
        agent: "assignment",
      };
    }

    const groundedInstruction = `${plan.notes}

Attach an assignment to this EXISTING lesson (do not invent a different topic):
Lesson: ${existing.title}
Module: ${module.title}
Summary: ${existing.contentSummary || "(none)"}
Content excerpt:
${existing.contentBody.slice(0, 2500) || "(empty)"}

Return an assignment brief, submission instructions, and a multiline markdown rubric table grounded in this lesson.`;

    let assignment = fallbackAssignment(existing.title, draft.name, module.title);
    try {
      const generated = await generateLessonDraft({
        programName: draft.name,
        moduleTitle: module.title,
        instruction: groundedInstruction,
        type: "assignment",
        titleHint: existing.title,
      });
      if (generated.assignment) assignment = generated.assignment;
    } catch {
      /* keep grounded fallback */
    }

    const updated: PersistedLesson = {
      ...existing,
      // Keep the original lesson type (reading/video/etc). Assignment is attached content.
      assignment,
      contentBody: existing.contentBody,
      contentSummary:
        existing.contentSummary ||
        `Includes an applied assignment for “${existing.title}” in ${module.title}.`,
    };

    const label = lessonLabel(draft, moduleIndex, plan.lessonIndex);
    return {
      agent: "assignment",
      summary: `Attached an assignment to ${label} without changing the lesson type. Nothing else was changed.`,
      ops: [
        {
          kind: "replace_lesson",
          moduleIndex,
          lessonIndex: plan.lessonIndex,
          lesson: updated,
        },
      ],
    };
  }

  const count = Math.min(plan.count, 4);
  const lessons = [];
  const previous =
    plan.lessonIndex != null
      ? module.lessons[plan.lessonIndex]
      : module.lessons[module.lessons.length - 1];
  const groundedInsert = previous
    ? `${plan.notes}

Ground this assignment in the previous lesson (do not invent an unrelated topic):
Lesson: ${previous.title}
Module: ${module.title}
Summary: ${previous.contentSummary || "(none)"}
Content excerpt:
${previous.contentBody.slice(0, 2000) || "(empty)"}`
    : plan.notes;

  for (let index = 0; index < count; index += 1) {
    const titleHint = count === 1 ? "Applied assignment" : `Applied assignment ${index + 1}`;
    const lesson = await generateLessonDraft({
      programName: draft.name,
      moduleTitle: module.title,
      instruction: groundedInsert,
      type: "assignment",
      titleHint,
    });
    if (!lesson.assignment) {
      lesson.assignment = fallbackAssignment(lesson.title, draft.name, module.title);
    }
    lessons.push(lesson);
  }

  const placement =
    plan.lessonIndex != null
      ? BEFORE_LESSON_RE.test(plan.notes)
        ? ` before ${moduleIndex + 1}.${plan.lessonIndex + 1}`
        : ` after ${moduleIndex + 1}.${plan.lessonIndex + 1}`
      : ` in “${module.title}”`;

  return {
    agent: "assignment",
    summary:
      lessons.length === 1
        ? `Added a new assignment lesson${placement}.`
        : `Added ${lessons.length} assignment lessons${placement}.`,
    ops: [placeLessonsOp(moduleIndex, lessons, plan.lessonIndex)],
  };
}
