import "server-only";

import { generateJson } from "../catalogPipeline/deepseek";
import { DESIGNER_SYSTEM, QUESTION_RULES } from "../catalogPipeline/prompts";
import type { PersistedLesson } from "../catalogPersistence";
import type { WhitbyQuestion } from "./types";
import { sanitizeLessonMarkdown } from "@/academy/admin/catalog/lib/lessonContentText";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";
import { parsePassingScorePercent } from "@/academy/lib/scorePercent";
import { LESSON_CONTENT_DESIGN_SYSTEM } from "@/academy/lib/lessonContentDesign";
import { COURSE_EDITOR_SYSTEM } from "./coAuthorSystem";

const BODY_RULES = `Write professional Academy draft copy that actually teaches — not an overview.
- learningObjectives: 3 concrete outcomes
- estimatedMinutes must be a string, e.g. "25"
- Stay on the program topic
- Reading/scenario/resource bodies: mechanism + worked example with numbers + common mistake + practice decision. Target 1000+ words.
- Never stop at objectives or a two-paragraph summary.

${LESSON_CONTENT_DESIGN_SYSTEM}`;

/** Models often return numbers (estimatedMinutes: 25) — calling .trim() on those throws. */
function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const text = value.trim();
    return text || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

type RawQuestion = {
  questionText?: string;
  type?: "multiple_choice" | "true_false";
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
};

export function sanitizeQuestions(raw: RawQuestion[] | undefined, limit: number): WhitbyQuestion[] {
  return (raw ?? []).slice(0, limit).map((item) => {
    const type = item.type === "true_false" ? ("true_false" as const) : ("multiple_choice" as const);
    const options =
      type === "true_false"
        ? ["True", "False"]
        : Array.isArray(item.options) && item.options.length >= 2
          ? item.options.map(String).slice(0, 6)
          : ["Option A", "Option B", "Option C", "Option D"];
    let correctAnswer = item.correctAnswer?.trim() || options[0] || "Option A";
    if (type === "true_false" && correctAnswer !== "True" && correctAnswer !== "False") {
      correctAnswer = "True";
    }
    if (!options.includes(correctAnswer)) {
      correctAnswer = options[0] ?? "Option A";
    }
    const questionText = stripQuizAnswerLeaks(item.questionText?.trim() || "Review question");
    return {
      questionText,
      type,
      options,
      correctAnswer,
    };
  });
}

export async function generateQuizPack(
  topic: string,
  source: string,
  count: number,
): Promise<{ passingScore: string; questions: WhitbyQuestion[] }> {
  const result = await generateJson<{ passingScore?: string; questions?: RawQuestion[] }>(
    `${COURSE_EDITOR_SYSTEM}

${DESIGNER_SYSTEM}

You are the Academy Quiz Agent. ${QUESTION_RULES}

Ground every question in the SOURCE material. Prefer scenario questions that check application, not trivia.
Never invent facts that are not supported by the source. If the source is thin, ask about core definitions from the titles provided — do not invent unrelated domains.`,
    `COURSE: ${topic}

SOURCE:
${source.slice(0, 6000)}

USER REQUEST: Produce ${count} quiz questions grounded in the source.

Return JSON: { "passingScore": "80", "questions": [{ "questionText", "type", "options", "correctAnswer", "explanation" }] }
Mix multiple_choice and true_false. correctAnswer must exactly match one option.`,
    { temperature: 0.4, maxTokens: 5000 },
  );

  const questions = sanitizeQuestions(result?.questions, count);
  return {
    passingScore: String(parsePassingScorePercent(result?.passingScore)),
    questions:
      questions.length > 0
        ? questions
        : [
            {
              questionText: `Which idea from "${topic}" should a practitioner apply first?`,
              type: "multiple_choice",
              options: [
                "The core working method",
                "An incidental detail",
                "An unrelated tactic",
                "None of these",
              ],
              correctAnswer: "The core working method",
            },
          ],
  };
}

export async function generateLessonDraft(input: {
  programName: string;
  moduleTitle: string;
  instruction: string;
  type: PersistedLesson["type"];
  titleHint?: string;
  videoUrl?: string;
  /** Titles already in the course / this batch — must not be reused or near-duplicated. */
  avoidTitles?: string[];
}): Promise<PersistedLesson> {
  let result: {
    title?: string;
    contentSummary?: string;
    contentBody?: string;
    learningObjectives?: string[];
    videoUrl?: string;
    assignment?: {
      brief?: unknown;
      submissionInstructions?: unknown;
      rubric?: unknown;
      estimatedMinutes?: unknown;
    };
  } | null = null;

  const avoid = (input.avoidTitles ?? []).filter(Boolean).slice(-24);

  try {
    result = await generateJson(
      `${COURSE_EDITOR_SYSTEM}

${DESIGNER_SYSTEM}

You are the Academy Lesson Agent. ${BODY_RULES}
Return JSON for ONE ${input.type} lesson.
Titles must be unique and cover a different topic than any Avoid list entry.`,
      `COURSE:
Program: ${input.programName}
Module: ${input.moduleTitle}
Requested type: ${input.type}
${input.titleHint ? `Preferred title direction: ${input.titleHint}` : ""}
${input.videoUrl ? `Video URL: ${input.videoUrl}` : ""}
${avoid.length ? `Avoid near-duplicate titles (do not reuse these topics):\n- ${avoid.join("\n- ")}` : ""}

USER REQUEST:
${input.instruction}

Return JSON: { "title", "contentSummary", "contentBody", "learningObjectives"${
        input.type === "assignment"
          ? `, "assignment": { "brief", "submissionInstructions", "rubric", "estimatedMinutes": "25" }`
          : ""
      }${input.type === "video" ? `, "videoUrl"` : ""} }

For assignments: brief and submissionInstructions are learner-facing — never include a model solution, sample answer, or answer key. Put grading criteria only in rubric (instructors only).`,
      { temperature: 0.45, maxTokens: 8000, label: "whitby-lesson" },
    );
  } catch (error) {
    console.error("[generateLessonDraft]", error);
  }

  const title =
    asText(result?.title) ||
    input.titleHint ||
    (input.type === "quiz"
      ? "Knowledge check"
      : input.type === "assignment"
        ? "Applied assignment"
        : input.type === "video"
          ? "Video lesson"
          : input.type === "scenario"
            ? "Applied scenario"
            : input.type === "resource"
              ? "Resource lesson"
              : "New lesson");

  const lesson: PersistedLesson = {
    title,
    type: input.type,
    contentUrl: "",
    contentBody:
      sanitizeLessonMarkdown(asText(result?.contentBody)) ||
      `This ${input.type} lesson extends ${input.programName}. Complete it in sequence with the rest of ${input.moduleTitle}.`,
    contentSummary:
      asText(result?.contentSummary) ||
      `A ${input.type} lesson that builds on ${input.moduleTitle} in ${input.programName}.`,
    learningObjectives: Array.isArray(result?.learningObjectives)
      ? result.learningObjectives.map(String).filter(Boolean).slice(0, 6)
      : [`Apply the ideas from ${title} in professional practice.`],
    videoUrl: input.videoUrl || asText(result?.videoUrl) || "",
    videoDurationSeconds: 0,
    resources: [],
    assignment: null,
    quiz: null,
  };

  if (input.type === "assignment") {
    const assignment = result?.assignment;
    lesson.assignment = {
      brief:
        asText(assignment?.brief) ||
        `Apply the ideas from ${input.moduleTitle} in ${input.programName}. Produce a professional work product a colleague could review.`,
      submissionInstructions:
        asText(assignment?.submissionInstructions) ||
        "Submit a written response covering your approach, evidence, and next step.",
      rubric:
        asText(assignment?.rubric) ||
        "Clarity, professional judgment, and completeness. Partial credit for a sound method with thin evidence.",
      estimatedMinutes: asText(assignment?.estimatedMinutes, "25"),
    };
  }

  return lesson;
}
