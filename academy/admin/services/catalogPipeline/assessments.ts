import "server-only";

import { generateJson } from "./deepseek";
import {
  DESIGNER_SYSTEM,
  QUESTION_RULES,
  calibrationBlock,
  jsonDiscipline,
  lessonDigest,
} from "./prompts";
import type { Blueprint, PipelineLesson, PipelineModule } from "./types";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";

type RawQuestion = {
  questionText?: string;
  type?: "multiple_choice" | "true_false";
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
};

function toQuestion(raw: RawQuestion) {
  const type = raw.type === "true_false" ? ("true_false" as const) : ("multiple_choice" as const);
  const options =
    type === "true_false"
      ? ["True", "False"]
      : Array.isArray(raw.options) && raw.options.length >= 2
        ? raw.options.map(String)
        : ["Option A", "Option B", "Option C", "Option D"];
  let correctAnswer = raw.correctAnswer?.trim() || options[0];
  // Guard against the model returning an answer that isn't one of the options
  // (otherwise the question has no valid answer to grade against).
  if (type === "true_false" && !["True", "False"].includes(correctAnswer)) {
    correctAnswer = "True";
  } else if (
    type === "multiple_choice" &&
    !options.some((option) => option.toLowerCase() === correctAnswer.toLowerCase())
  ) {
    correctAnswer = options[0];
  }
  // Keep the question text learner-safe — never fold explanation into the prompt.
  return {
    questionText: stripQuizAnswerLeaks(raw.questionText?.trim() || "Review question"),
    type,
    options,
    correctAnswer,
  };
}

function fallbackLessonQuiz(lesson: PipelineLesson): NonNullable<PipelineLesson["quiz"]> {
  return {
    passingScore: "80",
    questions: [
      {
        questionText: `Which concept from "${lesson.title}" is most important to apply in practice?`,
        type: "multiple_choice" as const,
        options: [
          "The core framework",
          "A peripheral detail",
          "An unrelated concept",
          "None of the above",
        ],
        correctAnswer: "The core framework",
      },
    ],
  };
}

export async function generateLessonQuiz(
  lesson: PipelineLesson,
  blueprint: Blueprint,
  signal?: AbortSignal,
): Promise<PipelineLesson> {
  const digest = lessonDigest({
    title: lesson.title,
    summary: lesson.summary,
    contentBody: lesson.contentBody,
    learningObjectives: lesson.learningObjectives,
  });

  const prompt = `Create a quiz for this lesson.

COURSE: ${blueprint.title}
${calibrationBlock(blueprint.difficulty)}

LESSON CONTENT:
${digest}

${QUESTION_RULES}

Return JSON: { passingScore: "80", questions: [{ questionText, type, options, correctAnswer, explanation }] }
Produce 4-6 questions grounded in the lesson content.

${jsonDiscipline()}`;

  const result = await generateJson<{ passingScore?: string; questions?: RawQuestion[] }>(
    DESIGNER_SYSTEM,
    prompt,
    { temperature: 0.45, maxTokens: 5000, signal, timeoutMs: 50_000 },
  );

  const questions = (result?.questions ?? []).slice(0, 8).map(toQuestion);
  return {
    ...lesson,
    contentBody:
      lesson.contentBody ||
      "Complete this knowledge check to confirm your understanding of the module.",
    quiz: {
      passingScore: result?.passingScore?.trim() || "80",
      questions: questions.length ? questions : fallbackLessonQuiz(lesson).questions,
    },
  };
}

/**
 * One DeepSeek call for every content lesson in a module (much faster than N serial calls).
 * Returns a new module with quizzes attached; quiz-kind / assignment lessons are unchanged.
 */
export async function generateContentQuizzesForModule(
  module: PipelineModule,
  blueprint: Blueprint,
  signal?: AbortSignal,
): Promise<PipelineModule> {
  const targets = module.lessons
    .map((lesson, index) => ({ lesson, index }))
    .filter(
      ({ lesson }) =>
        lesson.lessonKind !== "quiz" &&
        lesson.lessonKind !== "assignment" &&
        lesson.contentBody.trim().length > 120,
    );

  if (!targets.length) return module;

  const digests = targets
    .map(
      ({ lesson, index }) =>
        `LESSON_INDEX: ${index}
TITLE: ${lesson.title}
${lessonDigest({
  title: lesson.title,
  summary: lesson.summary,
  contentBody: lesson.contentBody,
  learningObjectives: lesson.learningObjectives,
})}`,
    )
    .join("\n\n---\n\n");

  const prompt = `Create a short knowledge-check quiz for EACH content lesson below.

COURSE: ${blueprint.title}
MODULE: ${module.title}
${calibrationBlock(blueprint.difficulty)}

${QUESTION_RULES}

LESSONS:
${digests}

Return JSON:
{
  "quizzes": [
    {
      "lessonIndex": 0,
      "passingScore": "80",
      "questions": [{ questionText, type, options, correctAnswer, explanation }]
    }
  ]
}

Rules:
- Include exactly one entry per LESSON_INDEX listed above.
- Produce 3-5 questions per lesson, grounded only in that lesson.
- lessonIndex must match the LESSON_INDEX values exactly.

${jsonDiscipline()}`;

  const result = await generateJson<{
    quizzes?: {
      lessonIndex?: number;
      passingScore?: string;
      questions?: RawQuestion[];
    }[];
  }>(DESIGNER_SYSTEM, prompt, {
    temperature: 0.4,
    maxTokens: Math.min(7000, 1800 + targets.length * 900),
    signal,
    timeoutMs: 70_000,
  });

  const byIndex = new Map<number, NonNullable<PipelineLesson["quiz"]>>();
  for (const entry of result?.quizzes ?? []) {
    const index = typeof entry.lessonIndex === "number" ? entry.lessonIndex : -1;
    if (index < 0 || index >= module.lessons.length) continue;
    const questions = (entry.questions ?? []).slice(0, 6).map(toQuestion);
    if (!questions.length) continue;
    byIndex.set(index, {
      passingScore: entry.passingScore?.trim() || "80",
      questions,
    });
  }

  return {
    ...module,
    lessons: module.lessons.map((lesson, index) => {
      if (!targets.some((target) => target.index === index)) return lesson;
      const quiz = byIndex.get(index) ?? fallbackLessonQuiz(lesson);
      return { ...lesson, quiz };
    }),
  };
}

export async function generateModuleQuizLesson(
  module: PipelineModule,
  blueprint: Blueprint,
  signal?: AbortSignal,
): Promise<PipelineLesson | null> {
  const quizLesson = module.lessons.find((l) => l.lessonKind === "quiz");
  if (!quizLesson) return null;

  const contentLessons = module.lessons.filter(
    (l) => l.lessonKind !== "quiz" && l.contentBody.length > 100,
  );
  if (!contentLessons.length) return quizLesson;

  const digests = contentLessons
    .map((l) =>
      lessonDigest({
        title: l.title,
        summary: l.summary,
        contentBody: l.contentBody,
        learningObjectives: l.learningObjectives,
      }),
    )
    .join("\n\n---\n\n");

  const prompt = `Create a module synthesis quiz.

COURSE: ${blueprint.title}
MODULE: ${module.title}

LESSON CONTENT:
${digests}

${QUESTION_RULES}

Return JSON: { passingScore: "80", questions: [{ questionText, type, options, correctAnswer, explanation }] }
Produce 6-10 synthesis questions spanning multiple lessons.

${jsonDiscipline()}`;

  const result = await generateJson<{ passingScore?: string; questions?: RawQuestion[] }>(
    DESIGNER_SYSTEM,
    prompt,
    { temperature: 0.45, maxTokens: 6000, signal, timeoutMs: 60_000 },
  );

  const questions = (result?.questions ?? []).slice(0, 12).map(toQuestion);
  return {
    ...quizLesson,
    contentBody: "This module quiz tests synthesis across all lessons in this module.",
    quiz: {
      passingScore: result?.passingScore?.trim() || "80",
      questions,
    },
  };
}

export async function generateFinalAssessment(
  modules: PipelineModule[],
  blueprint: Blueprint,
  signal?: AbortSignal,
): Promise<{
  title: string;
  contentBody: string;
  quiz: { passingScore: string; questions: ReturnType<typeof toQuestion>[] };
}> {
  const digests = modules
    .flatMap((m) => m.lessons)
    .filter((l) => l.lessonKind !== "quiz" && l.contentBody.length > 100)
    .slice(0, 12)
    .map((l) =>
      lessonDigest({
        title: l.title,
        summary: l.summary,
        contentBody: l.contentBody.slice(0, 1500),
        learningObjectives: l.learningObjectives,
      }),
    )
    .join("\n\n---\n\n");

  const prompt = `Create a final course assessment.

COURSE: ${blueprint.title}
DESCRIPTION: ${blueprint.description}

COURSE CONTENT SUMMARY:
${digests}

${QUESTION_RULES}

Return JSON:
{
  "title": "Final Assessment",
  "contentBody": "2-3 paragraphs describing the assessment format and expectations",
  "passingScore": "80",
  "questions": [{ questionText, type, options, correctAnswer, explanation }]
}

Produce 10-15 summative questions with at least half requiring cross-module synthesis.

${jsonDiscipline()}`;

  const result = await generateJson<{
    title?: string;
    contentBody?: string;
    passingScore?: string;
    questions?: RawQuestion[];
  }>(DESIGNER_SYSTEM, prompt, {
    temperature: 0.45,
    maxTokens: 8000,
    signal,
    timeoutMs: 70_000,
  });

  return {
    title: result?.title?.trim() || "Final Assessment",
    contentBody: result?.contentBody?.trim() || "Complete this final assessment to demonstrate mastery of the course material.",
    quiz: {
      passingScore: result?.passingScore?.trim() || "80",
      questions: (result?.questions ?? []).slice(0, 15).map(toQuestion),
    },
  };
}
