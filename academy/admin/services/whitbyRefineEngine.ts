import "server-only";

import { generateJson } from "./catalogPipeline/deepseek";
import type { WhitbyRefineContext } from "../actions";
import type { PersistedLesson, PersistedProgramDraft } from "./catalogPersistence";
import { professionalRefinementBrief, whitbyInstructorCapabilities } from "./catalogQuality";
import { sanitizeLessonMarkdown } from "@/academy/admin/catalog/lib/lessonContentText";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { LESSON_CONTENT_DESIGN_SYSTEM } from "@/academy/lib/lessonContentDesign";
import { COURSE_EDITOR_SYSTEM } from "./whitbyAgents/coAuthorSystem";

const LESSON_FORMAT = LESSON_CONTENT_DESIGN_SYSTEM;

type LessonRefineResponse = PersistedLesson & { summary: string };

type ProgramRefineResponse = PersistedProgramDraft & { summary: string };

function sanitizeLessonFromModel(raw: Partial<PersistedLesson>, fallback: PersistedLesson): PersistedLesson {
  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallback.title,
    type:
      raw.type === "video" ||
      raw.type === "attachment" ||
      raw.type === "quiz" ||
      raw.type === "scenario" ||
      raw.type === "resource" ||
      raw.type === "assignment" ||
      raw.type === "reading"
        ? raw.type
        : fallback.type,
    contentUrl: typeof raw.contentUrl === "string" ? raw.contentUrl : fallback.contentUrl,
    contentBody: typeof raw.contentBody === "string" ? sanitizeLessonMarkdown(raw.contentBody) : fallback.contentBody,
    contentSummary:
      typeof raw.contentSummary === "string" ? raw.contentSummary.trim() : fallback.contentSummary,
    learningObjectives: Array.isArray(raw.learningObjectives)
      ? raw.learningObjectives.map((item) => String(item)).filter(Boolean)
      : fallback.learningObjectives,
    videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl : fallback.videoUrl,
    videoDurationSeconds: fallback.videoDurationSeconds ?? 0,
    resources: Array.isArray(raw.resources)
      ? raw.resources.map((resource) => ({
          title: resource.title || "Resource",
          resourceType: resource.resourceType || "link",
          url: resource.url || "",
          notes: resource.notes || "",
        }))
      : fallback.resources,
    assignment: raw.assignment
      ? {
          brief: raw.assignment.brief ?? fallback.assignment?.brief ?? "",
          submissionInstructions:
            raw.assignment.submissionInstructions ??
            fallback.assignment?.submissionInstructions ??
            "",
          rubric: raw.assignment.rubric ?? fallback.assignment?.rubric ?? "",
          estimatedMinutes:
            raw.assignment.estimatedMinutes ?? fallback.assignment?.estimatedMinutes ?? "",
        }
      : fallback.assignment,
    quiz: raw.quiz
      ? {
          passingScore: raw.quiz.passingScore ?? fallback.quiz?.passingScore ?? "80",
          questions: Array.isArray(raw.quiz.questions)
            ? raw.quiz.questions.map((question) => ({
                questionText: stripQuizAnswerLeaks(question.questionText || "New question"),
                type: question.type === "true_false" ? ("true_false" as const) : ("multiple_choice" as const),
                options: Array.isArray(question.options)
                  ? question.options.map((item) => String(item)).filter(Boolean)
                  : [],
                correctAnswer: question.correctAnswer || "",
              }))
            : (fallback.quiz?.questions ?? []),
        }
      : fallback.quiz,
  };
}

export function resolveLessonLocation(
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): { moduleIndex: number; lessonIndex: number } | null {
  if (context?.moduleIndex != null && context.lessonIndex != null) {
    const module = draft.modules[context.moduleIndex];
    if (module?.lessons[context.lessonIndex]) {
      return { moduleIndex: context.moduleIndex, lessonIndex: context.lessonIndex };
    }
  }

  if (context?.focus === "lesson" && context.moduleTitle && context.lessonTitle) {
    const moduleIndex = draft.modules.findIndex((module) => module.title === context.moduleTitle);
    if (moduleIndex === -1) return null;
    const lessonIndex = draft.modules[moduleIndex].lessons.findIndex(
      (lesson) => lesson.title === context.lessonTitle,
    );
    if (lessonIndex === -1) return null;
    return { moduleIndex, lessonIndex };
  }

  return null;
}

export async function refineLessonWithWhitby(
  draft: PersistedProgramDraft,
  instruction: string,
  context: WhitbyRefineContext,
): Promise<(PersistedProgramDraft & { summary: string }) | null> {
  const location = resolveLessonLocation(draft, context);
  if (!location) return null;

  const { moduleIndex, lessonIndex } = location;
  const module = draft.modules[moduleIndex];
  const lesson = module.lessons[lessonIndex];

  const deepen = /\b(in[- ]?depth|shallow|thin|deepen|overview-level|1000\+\s*words|worked example)\b/i.test(
    instruction,
  );

  const system = `${COURSE_EDITOR_SYSTEM}

${whitbyInstructorCapabilities()}

You are editing ONE lesson only. ${LESSON_FORMAT}
${
  deepen
    ? `This lesson is too thin. Replace overview-level prose with a full teachable lesson at a professional level: mechanism, named/numbered worked example, common mistake, Scenario (Decision + Recommended answer), and an exercise. Target 1000+ words. Keep the title unless asked to change it.`
    : ""
}

Return JSON: { "summary": "one sentence describing what changed and why", "title", "type", "contentSummary", "contentBody", "learningObjectives", "videoUrl", "contentUrl", "resources", "assignment", "quiz" }`;

  const prompt = `COURSE:
${JSON.stringify(
    {
      program: draft.name,
      module: module.title,
      lesson,
    },
    null,
    2,
  )}

USER REQUEST:
${professionalRefinementBrief(instruction)}

Edit only this lesson. Keep type and structure unless the instructor asks to change them. Use **bold** markdown when the instructor asks for emphasis. For style/beautify/format-only requests: restructure into Definition / Scenario / Example / Summary / callout / fenced code shapes without inventing new facts. If the lesson is already correctly structured, return the same contentBody and say so honestly in summary — never claim a rewrite you did not make.${
    deepen ? " Do not return a short summary — write the full deeper body." : ""
  }`;

  const response = await generateJson<LessonRefineResponse>(system, prompt, {
    task: "write",
    temperature: 0.35,
    maxTokens: deepen ? 9000 : 6000,
    timeoutMs: deepen ? 80_000 : 55_000,
    stream: true,
    label: "whitby-edit-lesson",
  });
  if (!response?.summary) return null;

  const updated = sanitizeLessonFromModel(response, lesson);
  const modules = draft.modules.map((entry, index) =>
    index !== moduleIndex
      ? entry
      : {
          ...entry,
          lessons: entry.lessons.map((item, li) => (li !== lessonIndex ? item : updated)),
        },
  );

  return {
    ...draft,
    modules,
    summary: response.summary.trim(),
  };
}

export async function refineProgramWithWhitby(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext,
): Promise<(PersistedProgramDraft & { summary: string }) | null> {
  const focusNote =
    context?.focus === "overview"
      ? "Focus: program overview (title, description, structure)."
      : context?.focus === "module" && context.moduleTitle
        ? `Focus: module "${context.moduleTitle}".`
        : "";

  const compactDraft = {
    name: draft.name,
    description: draft.description,
    category: draft.category,
    type: draft.type,
    modules: draft.modules.map((module) => ({
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        title: lesson.title,
        type: lesson.type,
        contentSummary: lesson.contentSummary,
        learningObjectives: lesson.learningObjectives,
        contentBody:
          lesson.contentBody.length > 1200
            ? `${lesson.contentBody.slice(0, 1200)}\n\n[truncated — preserve full text unless asked to edit this lesson]`
            : lesson.contentBody,
        videoUrl: lesson.videoUrl,
        contentUrl: lesson.contentUrl,
        resources: lesson.resources,
        assignment: lesson.assignment,
        quiz: lesson.quiz,
      })),
    })),
  };

  const system = `${COURSE_EDITOR_SYSTEM}

${whitbyInstructorCapabilities()}

${LESSON_FORMAT}

Return JSON: { "name", "description", "category", "type", "summary", "modules": [{ "title", "lessons": [...] }] }
Include the COMPLETE program. Preserve untouched lesson content exactly.`;

  const prompt = `COURSE:
${JSON.stringify(compactDraft, null, 2)}

${focusNote ? `${focusNote}\n\n` : ""}USER REQUEST:
${professionalRefinementBrief(instruction)}

Return the full updated program JSON with a one-sentence summary of what changed and why.`;

  return generateJson<ProgramRefineResponse>(system, prompt, {
    // Full-program rewrites are the only path that opts into the reasoner model
    // when COURSEGEN_MODEL_REASONING is set; default stays deepseek-chat for speed.
    task: "reason",
    temperature: 0.35,
    maxTokens: 12000,
    stream: true,
    label: "whitby-rewrite-program",
  });
}
