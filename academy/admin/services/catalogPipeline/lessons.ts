import "server-only";

import {
  DEPTH_CONTRACT,
  DESIGNER_SYSTEM,
  calibrationBlock,
  contentWordCount,
  jsonDiscipline,
  lessonWordTarget,
  sourceRulesForRequest,
} from "./prompts";
import type { Blueprint, CatalogGenerationRequest, LessonPlan, PipelineLesson } from "./types";
import { sanitizeLessonMarkdown } from "@/academy/admin/catalog/lib/lessonContentText";
import { LESSON_CONTENT_DESIGN_SYSTEM } from "@/academy/lib/lessonContentDesign";
import { teachingContentIsComplete } from "@/academy/admin/lib/courseAttachmentText";
import { generateJson, generateText } from "./deepseek";
import { excerptForLesson } from "./sourceDocument";

function emptyLesson(plan: LessonPlan): PipelineLesson {
  return {
    title: plan.title,
    summary: plan.summary,
    lessonKind: plan.lessonKind,
    learningObjectives: plan.learningObjectives,
    durationMinutes: plan.durationMinutes,
    outline: plan.outline,
    introduction: "",
    contentBody: "",
    contentSummary: plan.summary,
    resources: [],
    assignment: null,
    quiz: null,
  };
}

export async function generateLessonBody(
  plan: LessonPlan,
  context: {
    request: CatalogGenerationRequest;
    blueprint: Blueprint;
    moduleTitle: string;
    moduleIndex: number;
    lessonIndex: number;
    priorLessons: { title: string; summary: string }[];
    nextLessonTitle?: string;
  },
  signal?: AbortSignal,
): Promise<PipelineLesson> {
  if (plan.lessonKind === "quiz") {
    return {
      ...emptyLesson(plan),
      contentSummary: "Knowledge check covering the module's key concepts.",
      contentBody: "",
    };
  }

  const words = lessonWordTarget(context.blueprint.difficulty, plan.lessonKind);
  const sourceExcerpt = excerptForLesson(context.request.source, plan.title, plan.outline);
  const level = context.blueprint.difficulty;

  const prompt = `Write the FULL teaching body of one lesson as markdown. Do not return JSON. Do not stop at an outline, objectives list, or heading-and-bullets skeleton.

COURSE: ${context.blueprint.title}
LEVEL: ${level}
${calibrationBlock(level)}
MODULE: ${context.moduleTitle}
LESSON: ${plan.title}
KIND: ${plan.lessonKind}
SUMMARY: ${plan.summary}
OBJECTIVES (teach each of these in the body — do not only list them):
${plan.learningObjectives.map((item, index) => `${index + 1}. ${item}`).join("\n") || "- (derive from the outline)"}

OUTLINE — this is STRUCTURE only. Expand every beat into real teaching content:
${plan.outline.map((beat, index) => `${index + 1}. ${beat}`).join("\n") || "- derive from the summary"}

${
  sourceExcerpt
    ? `SOURCE EXCERPT (PRIMARY teaching material — stay faithful):\n${sourceExcerpt}`
    : ""
}

${sourceRulesForRequest(context.request)}

ALREADY TAUGHT:
${
  context.priorLessons.length
    ? context.priorLessons
        .slice(-8)
        .map((l) => `- ${l.title}: ${l.summary}`)
        .join("\n")
    : "- nothing yet"
}
${context.nextLessonTitle ? `TAUGHT NEXT (do not pre-empt): ${context.nextLessonTitle}` : ""}

${DEPTH_CONTRACT}

LENGTH: ${words.target} words (minimum ${words.min}). Honor LEVEL ${level} exactly.
Required sections: introduction, explanation of the mechanism, detailed teaching content, a worked example, practical application, key takeaways.
DEFINITIONS (required — each becomes a professional Definition card in the LMS):
Definition — Short term name
One or two clear sentences that define it (on the NEXT line). Never put the full definition on the name line. Never repeat the same paragraph as both name and meaning. Never leave key terms as plain paragraphs — use this shape so the card UI renders.
${LESSON_CONTENT_DESIGN_SYSTEM}`;

  const writeMarkdown = async (userPrompt: string, temperature: number) => {
    const markdown = await generateText(DESIGNER_SYSTEM, userPrompt, {
      temperature,
      maxTokens: 7000,
      timeoutMs: 70_000,
      signal,
      task: "write",
      stream: true,
      label: "lesson-body",
    }).catch(() => "");
    const contentBody = sanitizeLessonMarkdown(markdown);
    return {
      ...emptyLesson(plan),
      contentBody,
      contentSummary: plan.summary,
    };
  };

  let best = await writeMarkdown(prompt, 0.45);
  if (teachingContentIsComplete(best.contentBody, level, plan.lessonKind)) {
    return best;
  }

  const retry = await writeMarkdown(
    `${prompt}

REWRITE: the previous draft was ${contentWordCount(best.contentBody)} words and was not a complete ${level} lesson. Write the full ${words.target}-word lesson now. Teach the mechanism; do not restate the title as bullets.`,
    0.3,
  );
  if (teachingContentIsComplete(retry.contentBody, level, plan.lessonKind)) {
    return retry;
  }
  if (contentWordCount(retry.contentBody) > contentWordCount(best.contentBody)) {
    best = retry;
  }
  return best;
}

export async function generateAssignmentContent(
  plan: LessonPlan,
  moduleLessons: PipelineLesson[],
  blueprint: Blueprint,
  signal?: AbortSignal,
): Promise<PipelineLesson> {
  const context = moduleLessons
    .filter((l) => l.lessonKind !== "quiz" && l.contentBody.length > 100)
    .map((l) => lessonDigest(l))
    .join("\n\n---\n\n");

  const prompt = `Create a professional assignment for this module.

COURSE: ${blueprint.title}
LEVEL: ${blueprint.difficulty}
${calibrationBlock(blueprint.difficulty)}
MODULE LESSONS:
${context}

ASSIGNMENT TITLE: ${plan.title}

The assignment must match LEVEL ${blueprint.difficulty}: beginner scaffolds a first complete deliverable; intermediate requires a trade-off; advanced requires a production-grade artifact.

Return JSON:
{
  "brief": "2-3 paragraphs describing the assignment scenario for the learner (what to do) — never include a model solution or sample answers",
  "submissionInstructions": "clear step-by-step submission instructions without revealing a correct answer",
  "rubric": "instructor-only grading rubric as a MULTILINE markdown table (one row per line), e.g.\\n| Criteria | Excellent | Good | Needs work |\\n| --- | --- | --- | --- |\\n| Clarity | … | … | … | — never jam the whole table onto one line",
  "estimatedMinutes": "45",
  "contentBody": "learner-facing assignment overview (3-4 paragraphs) — task framing only, no worked answer"
}

Never put the model answer, sample submission, or "correct" solution in brief, contentBody, or submissionInstructions. Rubric may describe quality criteria without giving away the solution text.

${jsonDiscipline()}`;

  let result = await generateJson<{
    brief?: unknown;
    submissionInstructions?: unknown;
    rubric?: unknown;
    estimatedMinutes?: unknown;
    contentBody?: unknown;
  }>(DESIGNER_SYSTEM, prompt, { temperature: 0.5, maxTokens: 5000, signal }).catch(() => null);

  if (!asText(result?.brief)) {
    result = await generateJson<{
      brief?: unknown;
      submissionInstructions?: unknown;
      rubric?: unknown;
      estimatedMinutes?: unknown;
      contentBody?: unknown;
    }>(DESIGNER_SYSTEM, `${prompt}\n\nThe previous assignment draft was empty. Return the JSON assignment now.`, {
      temperature: 0.35,
      maxTokens: 5000,
      signal,
    }).catch(() => null);
  }

  let brief = asText(result?.brief);
  let contentBody = asText(result?.contentBody) || brief;
  if (!brief || !teachingContentIsComplete(contentBody, blueprint.difficulty, "assignment")) {
    const retry = await generateJson<{
      brief?: unknown;
      submissionInstructions?: unknown;
      rubric?: unknown;
      estimatedMinutes?: unknown;
      contentBody?: unknown;
    }>(
      DESIGNER_SYSTEM,
      `${prompt}

REWRITE: the previous assignment was incomplete for LEVEL ${blueprint.difficulty}. Return the full JSON assignment now with a learner-facing contentBody of at least 220 words.`,
      { temperature: 0.3, maxTokens: 5000, signal },
    ).catch(() => null);
    if (asText(retry?.brief)) {
      result = retry;
      brief = asText(result?.brief);
      contentBody = asText(result?.contentBody) || brief;
    }
  }
  if (!brief) {
    throw new Error(`Could not write assignment "${plan.title}".`);
  }
  if (!teachingContentIsComplete(contentBody, blueprint.difficulty, "assignment")) {
    throw new Error(`Assignment "${plan.title}" was not complete at ${blueprint.difficulty} level.`);
  }
  return {
    ...emptyLesson(plan),
    contentBody,
    contentSummary: plan.summary,
    assignment: {
      brief,
      submissionInstructions: asText(result?.submissionInstructions),
      rubric: asText(result?.rubric),
      estimatedMinutes: asText(result?.estimatedMinutes, "45"),
    },
  };
}

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const text = value.trim();
    return text || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function lessonDigest(lesson: PipelineLesson): string {
  return `${lesson.title}\n${lesson.summary}\n${lesson.contentBody.slice(0, 2000)}`;
}
