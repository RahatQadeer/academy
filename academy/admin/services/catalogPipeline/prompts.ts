import "server-only";

import type { CatalogDifficulty, CatalogGenerationRequest } from "./types";
import { LESSON_CONTENT_DESIGN_SYSTEM } from "@/academy/lib/lessonContentDesign";
import { buildCourseGenContextBlock, sourcePriorityRules } from "@/academy/admin/lib/courseAttachmentText";

export const DESIGNER_SYSTEM = `You are a senior instructional designer with 15 years of experience building professional curricula for universities and corporate academies. You write like a great textbook author: precise, concrete, and free of filler.

Non-negotiable standards:
- Accuracy first. Never state something you are not confident is true.
- Teach, don't summarise. Explain mechanisms and reasoning, not just definitions.
- Honor the requested LEVEL exactly. Beginner still teaches a complete skill; Intermediate is not a beginner recap; Advanced is not a summary of fundamentals.
- Be specific. Real tools, real numbers, named people, worked examples, and the mistake a practitioner actually makes.
- Learning objectives are not the lesson. The body must teach each objective fully.
- No filler. Ban phrases like "In today's fast-paced world", "It is important to note", "Let's dive in", "In conclusion".
- No meta-commentary about being an AI.
- Every sentence must carry information a learner did not have before reading it.

${LESSON_CONTENT_DESIGN_SYSTEM}`;

export const DIFFICULTY_GUIDE: Record<CatalogDifficulty, string> = {
  beginner:
    "BEGINNER — first-time learner, zero assumed jargon. Define every term on first use. One new idea per section, then immediately show a small worked example. Use everyday analogies, then translate them into the real tool or decision. Include a 'try this' check after each idea. Still teach a complete procedure — never a 2-paragraph overview. Scaffold; do not shallow.",
  intermediate:
    "INTERMEDIATE — fundamentals are already known; do not reteach definitions unless a precise distinction is at stake. Teach how pieces fit, trade-offs, and the mistakes people make once they know the basics. Use side-by-side comparisons, numbers, and 'if you choose A, you pay B'. Include at least one case that looks right but fails in production. Depth means reasoning, not extra adjectives.",
  advanced:
    "ADVANCED — assume strong working knowledge. Go into mechanisms, second-order effects, edge cases, and production-grade constraints (cost, time, risk, quality). Skip elementary recap. Use failure modes, exception handling, and decisions a senior practitioner would actually debate. Cite concrete thresholds, not slogans.",
};

export const DEPTH_CONTRACT = `DEPTH CONTRACT — every reading, scenario, resource, and video lesson must include all of the following in the body (objectives alone are not enough):
1. Mechanism — what it is and how it actually works, at the requested level.
2. Worked example — named people/tools and real numbers, constraints, or measurements.
3. Contrast or common mistake — what a learner at this level gets wrong, and why.
4. Practice decision — how this changes a real production/practice choice.
5. One Scenario block with Decision + Recommended answer.
6. One exercise fence.

Do not stop after an introduction and a 'by the end of this lesson' list. That is an outline, not a lesson.`;

export function lessonWordTarget(
  difficulty: CatalogDifficulty,
  kind: "reading" | "scenario" | "assignment" | "quiz" | "video" | "resource",
): { min: number; target: string } {
  if (kind === "quiz") return { min: 0, target: "0" };
  if (kind === "assignment") {
    if (difficulty === "advanced") return { min: 450, target: "500-750" };
    if (difficulty === "intermediate") return { min: 400, target: "450-700" };
    return { min: 350, target: "400-650" };
  }
  if (kind === "scenario") {
    if (difficulty === "advanced") return { min: 700, target: "800-1100" };
    if (difficulty === "intermediate") return { min: 600, target: "700-1000" };
    return { min: 500, target: "600-900" };
  }
  if (difficulty === "advanced") return { min: 900, target: "1200-1700" };
  if (difficulty === "intermediate") return { min: 750, target: "1000-1500" };
  return { min: 650, target: "900-1400" };
}

export function contentWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeDifficulty(value: string): CatalogDifficulty {
  const lower = value.trim().toLowerCase();
  if (lower === "beginner") return "beginner";
  if (lower === "advanced") return "advanced";
  return "intermediate";
}

export function briefBlock(request: CatalogGenerationRequest, blueprint?: { title?: string }): string {
  return buildCourseGenContextBlock(request, blueprint);
}

export function sourceRulesForRequest(request: CatalogGenerationRequest): string {
  return sourcePriorityRules(Boolean(request.source?.hasSource || request.attachments?.length));
}

export function calibrationBlock(difficulty: CatalogDifficulty): string {
  return `LEVEL CALIBRATION — ${difficulty}: ${DIFFICULTY_GUIDE[difficulty]}`;
}

export function jsonDiscipline(): string {
  return "Return only valid JSON matching the requested shape. Every string must be plain prose — no markdown headings or bullet characters in JSON string values. Never write the words undefined or null as placeholders; if a pair or table cell is unknown, omit that item.";
}

export function lessonDigest(lesson: {
  title: string;
  summary: string;
  contentBody: string;
  learningObjectives: string[];
}): string {
  return [
    `LESSON: ${lesson.title}`,
    `SUMMARY: ${lesson.summary}`,
    lesson.learningObjectives.length
      ? `OBJECTIVES:\n${lesson.learningObjectives.map((o) => `- ${o}`).join("\n")}`
      : null,
    lesson.contentBody.slice(0, 4000),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const QUESTION_RULES = `QUESTION RULES:
- Prefer applied, scenario-based questions: open with a short, realistic situation drawn from the lesson, then ask what the learner should conclude or do. At least half of the questions must be scenario-based.
- Match the course LEVEL: beginner checks definitions and first procedures; intermediate checks trade-offs and common mistakes; advanced checks edge cases and production judgment. Never ask beginner trivia on an intermediate/advanced course.
- Every question must be answerable from the lesson content provided.
- Test understanding and application, not phrase recall.
- If the course was generated from a source document, questions must test that document's concepts as taught in the lesson — never CourseGen, prompting, or AI-course-creation trivia unless the lesson is about those topics.
- Give exactly one correct answer and 3 distractors that are plausible real-world misconceptions.
- questionText must be the learner-facing prompt ONLY. Never include the correct answer, "Answer:", "Explanation:", hints that reveal the key, or phrases like "the answer is".
- Put the answer only in correctAnswer. Put teaching rationale only in explanation (instructor answer key — never duplicated into questionText or options).
- Options must not be labeled "correct" / "wrong", and distractors must not confess they are incorrect.
- true_false options must be exactly ["True", "False"].`;
