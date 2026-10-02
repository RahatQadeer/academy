import "server-only";

import type { PersistedProgramDraft } from "../catalogPersistence";
import { generateLessonDraft, generateQuizPack } from "./content";
import { placeLessonsOp } from "./apply";
import type { WhitbyAgentResult, WhitbyPlan } from "./types";

function moduleDigest(draft: PersistedProgramDraft, moduleIndex: number): string {
  const module = draft.modules[moduleIndex];
  if (!module) return draft.description;
  return [
    `Program: ${draft.name}`,
    `Module: ${module.title}`,
    ...module.lessons.slice(-4).map(
      (lesson) => `${lesson.title} (${lesson.type}): ${lesson.contentSummary || lesson.contentBody.slice(0, 280)}`,
    ),
  ].join("\n");
}

function lessonSource(
  draft: PersistedProgramDraft,
  moduleIndex: number,
  lessonIndex: number | null | undefined,
): string {
  const module = draft.modules[moduleIndex];
  if (!module) return draft.description;
  if (lessonIndex == null || !module.lessons[lessonIndex]) {
    return moduleDigest(draft, moduleIndex);
  }
  const lesson = module.lessons[lessonIndex];
  return [
    `Program: ${draft.name}`,
    `Module: ${module.title}`,
    `Focus lesson: ${lesson.title} (${lesson.type})`,
    lesson.contentSummary ? `Summary: ${lesson.contentSummary}` : "",
    lesson.contentBody ? `Body:\n${lesson.contentBody.slice(0, 5000)}` : "",
    lesson.learningObjectives?.length
      ? `Objectives: ${lesson.learningObjectives.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runQuizAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
): Promise<WhitbyAgentResult> {
  const moduleIndex = plan.moduleIndex ?? Math.max(0, draft.modules.length - 1);
  const module = draft.modules[moduleIndex];
  if (!module) {
    return { ops: [], summary: "No module is available for a quiz yet.", agent: "quiz" };
  }

  const questionCount = plan.intents.includes("expand_quiz")
    ? Math.min(Math.max(plan.count, 3), 8)
    : 5;

  if (plan.intents.includes("expand_quiz") && plan.lessonIndex != null) {
    const lesson = module.lessons[plan.lessonIndex];
    if (lesson) {
      const pack = await generateQuizPack(
        draft.name,
        lessonSource(draft, moduleIndex, plan.lessonIndex),
        questionCount,
      );
      return {
        agent: "quiz",
        summary: `Added ${pack.questions.length} quiz question${pack.questions.length === 1 ? "" : "s"} to “${lesson.title}”, grounded in that lesson.`,
        ops: [
          {
            kind: "append_quiz_questions",
            moduleIndex,
            lessonIndex: plan.lessonIndex,
            questions: pack.questions,
            passingScore: pack.passingScore,
          },
        ],
      };
    }
  }

  // When a non-quiz lesson is selected, one quiz after it is usually the intent —
  // ground questions on that lesson instead of a thin module digest.
  const quizLessonCount = Math.min(plan.count, 4);
  const groundIndex =
    plan.lessonIndex != null && module.lessons[plan.lessonIndex]
      ? plan.lessonIndex
      : module.lessons.length
        ? module.lessons.length - 1
        : null;

  const lessons = [];
  for (let index = 0; index < quizLessonCount; index += 1) {
    const lesson = await generateLessonDraft({
      programName: draft.name,
      moduleTitle: module.title,
      instruction: plan.notes,
      type: "quiz",
      titleHint: quizLessonCount === 1 ? "Knowledge check" : `Knowledge check ${index + 1}`,
    });
    const pack = await generateQuizPack(
      draft.name,
      lessonSource(draft, moduleIndex, groundIndex),
      questionCount,
    );
    lesson.quiz = pack;
    lesson.contentBody =
      lesson.contentBody || "Complete this knowledge check to confirm the module so far.";
    lessons.push(lesson);
  }

  return {
    agent: "quiz",
    summary:
      lessons.length === 1
        ? `Added a quiz${plan.lessonIndex != null ? ` after ${moduleIndex + 1}.${plan.lessonIndex + 1}` : ` in “${module.title}”`} with ${lessons[0]?.quiz?.questions.length ?? 0} questions grounded in the nearby lesson.`
        : `Added ${lessons.length} quizzes in “${module.title}”.`,
    ops: [placeLessonsOp(moduleIndex, lessons, plan.lessonIndex)],
  };
}
