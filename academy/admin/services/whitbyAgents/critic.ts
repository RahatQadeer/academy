import "server-only";

import type { PersistedLesson, PersistedProgramDraft } from "../catalogPersistence";
import type { OrchestratedRefine } from "./types";
import { stripQuizAnswerLeaks } from "@/academy/lib/quizQuestionText";

// Independent quality gate that runs AFTER generation and BEFORE commit. It is
// deliberately deterministic (no extra LLM calls, so it adds no cost or
// latency) and catches the mistakes agents make most often: duplicated
// lessons, and quiz questions whose "correct" answer isn't actually one of the
// options. Safe fixes are applied in place; anything that can't be safely
// fixed is reported so the instructor can review — never silently trusted.

export type Critique = {
  draft: OrchestratedRefine;
  notes: string[];
};

const CONTENT_TYPES: PersistedLesson["type"][] = ["reading", "scenario", "resource"];

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/^lesson\s*\d+\s*[:.\-—–]?\s*/i, "")
    .replace(/\b(lesson|part|section|unit)\s*\d+\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleTokens(value: string): Set<string> {
  return new Set(
    normalizeTitle(value)
      .split(" ")
      .filter((token) => token.length > 1 && !/^\d+$/.test(token)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

/** Near-duplicate titles like "Lesson 5: Foo — Bar" vs "Lesson 6: Foo: Bar". */
const DUPLICATE_THRESHOLD = 0.72;

/** Drop newly-generated content lessons that duplicate another lesson already
 * in the same module. Pre-existing lessons are never touched. */
function dedupeLessons(
  before: PersistedProgramDraft,
  after: OrchestratedRefine,
  notes: string[],
): void {
  // Course-wide set of titles that existed before this change. A lesson whose
  // title is in here is pre-existing content and is never dropped — this holds
  // even if a module was renamed in the same instruction.
  const existingTitles = new Set(
    before.modules.flatMap((module) => module.lessons.map((lesson) => normalizeTitle(lesson.title))),
  );

  for (const module of after.modules) {
    const kept: PersistedLesson[] = [];
    const seen: { title: string; tokens: Set<string> }[] = [];

    for (const lesson of module.lessons) {
      const isContent = CONTENT_TYPES.includes(lesson.type);
      const isNew = !existingTitles.has(normalizeTitle(lesson.title));

      if (isContent && isNew) {
        const tokens = titleTokens(lesson.title);
        const duplicate = seen.find((entry) => jaccard(entry.tokens, tokens) >= DUPLICATE_THRESHOLD);
        if (duplicate) {
          notes.push(
            `Skipped a near-duplicate lesson “${lesson.title}” — “${duplicate.title}” already covers it.`,
          );
          continue;
        }
      }

      seen.push({ title: lesson.title, tokens: titleTokens(lesson.title) });
      kept.push(lesson);
    }

    module.lessons = kept;
  }
}

/** Normalize true/false answers and flag questions whose correct answer isn't
 * among the options. Questions are flagged, not deleted — this is draft content
 * the instructor still reviews, and silently dropping work is its own hazard. */
function validateQuizzes(after: OrchestratedRefine, notes: string[]): void {
  let flagged = 0;

  for (const module of after.modules) {
    for (const lesson of module.lessons) {
      const quiz = lesson.quiz;
      if (!quiz) continue;

      for (const question of quiz.questions) {
        question.questionText = stripQuizAnswerLeaks(question.questionText.trim());

        if (question.type === "true_false") {
          question.options = ["True", "False"];
          const answer = question.correctAnswer.trim().toLowerCase();
          if (answer === "true" || answer === "false") {
            question.correctAnswer = answer === "true" ? "True" : "False";
          } else {
            flagged += 1;
          }
          continue;
        }

        // multiple_choice
        const options = question.options.map((option) => option.trim()).filter(Boolean);
        const answer = question.correctAnswer.trim();
        const matches = options.some((option) => option.toLowerCase() === answer.toLowerCase());
        if (options.length < 2 || !answer || !matches) {
          flagged += 1;
        }
      }
    }
  }

  if (flagged > 0) {
    notes.push(
      `Heads up: ${flagged} quiz question${flagged === 1 ? "" : "s"} may need a look — the marked answer isn't clearly one of the options.`,
    );
  }
}

export function critiqueRefinement(
  before: PersistedProgramDraft,
  after: OrchestratedRefine,
): Critique {
  const notes: string[] = [];
  dedupeLessons(before, after, notes);
  validateQuizzes(after, notes);
  return { draft: after, notes };
}
