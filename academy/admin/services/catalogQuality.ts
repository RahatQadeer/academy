import "server-only";

import type { PersistedProgramDraft } from "./catalogPersistence";

export function isProfessionalDraft(draft: PersistedProgramDraft) {
  if (draft.modules.length < 3) return false;
  let richLessonCount = 0;
  let quizQuestionCount = 0;

  for (const module of draft.modules) {
    if (module.lessons.length < 2) return false;
    for (const lesson of module.lessons) {
      if (
        (lesson.type === "reading" ||
          lesson.type === "scenario" ||
          lesson.type === "resource" ||
          lesson.type === "assignment") &&
        lesson.contentBody.trim().length >= 1200
      ) {
        richLessonCount += 1;
      }
      if (lesson.type === "video" && lesson.contentSummary.trim().length >= 120) {
        richLessonCount += 1;
      }
      if (lesson.quiz) {
        quizQuestionCount += lesson.quiz.questions.length;
      }
    }
  }

  return richLessonCount >= Math.min(6, draft.modules.length * 2) && quizQuestionCount >= 5;
}

export function professionalDraftBrief(prompt: string, length: string, difficulty: string, type: string) {
  return `Create a professional Academy course draft.
- Source topic: ${prompt}
- Preferred length: ${length}
- Difficulty: ${difficulty}
- Program type: ${type}

Quality requirements:
- Honor difficulty ${difficulty} exactly (beginner scaffolds; intermediate teaches trade-offs; advanced covers mechanisms and edge cases)
- produce a serious professional learning experience, not outline bullets or objective lists
- each reading/scenario/resource lesson must TEACH: mechanism, worked example with numbers, common mistake, and a practice decision — usually 1000+ words, never a short overview
- include practical learning objectives AND body copy that actually teaches them
- include scenario-based learning where relevant
- include useful resources where relevant
- include at least one real assessment path with a quiz containing 5+ questions
- assignment lessons must include a real brief, instructions, and rubric
- avoid placeholder text like TBD, Lorem Ipsum, Sample, Example only
- content should feel publishable as a strong first draft`;
}

export function professionalRefinementBrief(instruction: string) {
  const beautify =
    /\b(beautif\w*|prettier|nicer|polish|visual|ui|card|cards|definition|scenario|style|format|objectives?|make it (look )?(better|nice|professional|pretty)|fix formatting)\b/i.test(
      instruction,
    );
  const extra = beautify
    ? `

UI / LAYOUT POLISH (instructor asked to improve how the lesson looks — preserve facts):
- Convert key terms into Definition — Name / meaning cards (two lines).
- Convert imagine/suppose situations into Scenario cards (Decision + Recommended answer).
- Convert walkthroughs into Example — Title / body cards.
- Convert wrap-ups into Summary — … or Key takeaways.
- Put tips/warnings in [Tip]/[Important] callouts; code in fenced blocks with a language tag.
- Prefer ## headings and short lists over long undifferentiated paragraphs.
- If already correctly structured, return the same contentBody and say so honestly — never invent a fake rewrite.`
    : "";
  return `Apply this instructor instruction exactly: "${instruction}"${extra}`;
}

export function isRefinementDraftValid(draft: PersistedProgramDraft) {
  if (!draft.name.trim() || draft.modules.length === 0) return false;
  return draft.modules.every((module) => module.title.trim() && module.lessons.length > 0);
}

export function whitbyInstructorCapabilities() {
  return `You are Whitby, an Academy course co-author working with an instructor in the Course Builder.

You can change ANY part of the draft when asked:
- program title, description, category, and type
- add, remove, rename, or reorder modules
- add, remove, rename, or reorder lessons
- change lesson type (reading, video, quiz, scenario, resource, assignment, attachment)
- rewrite lesson body copy, summaries, and learning objectives
- use **bold** (two asterisks) for emphasis — never ***triple asterisks***
- use fenced \`\`\`jsx code blocks\`\`\` for multi-line code, \`backticks\` for inline code
- add or edit resources, assignments (brief, instructions, rubric), and quizzes (questions, options, correct answers)
- improve assessments, tighten titles, or expand thin content
- **beautify / polish lesson UI**: turn plain prose into Definition / Scenario / Example / Summary cards, [Tip]/[Important] callouts, ## headings, fenced code, and short lists — without inventing new facts

Edit discipline:
- Follow the instructor instruction precisely; make only the necessary changes.
- Preserve untouched lessons verbatim — same title, type, contentBody, resources, assignment, and quiz.
- Never blindly rewrite the entire course; keep learning progression and avoid duplicates.
- When adding or deepening content, write substantive professional draft copy (not placeholders, objective lists, or bullet-only outlines). Honor beginner / intermediate / advanced: scaffold for beginner, trade-offs for intermediate, mechanisms and edge cases for advanced.
- When the instructor asks to style / format / fix formatting without changing content: restructure markdown only; if already structured, report that honestly instead of claiming Done.
- When the instructor asks to make content beautiful / nicer / more professional / prettier / improve UI / format definitions as cards: restructure markdown for the LMS card UI while keeping the same teaching facts.
- When removing items, omit them from the returned structure.
- Only rewrite the whole program when the instructor asked to rebuild it.
- For destructive or ambiguous structure changes, prefer clarifying over guessing.
- Return ONLY valid structured JSON — the COMPLETE updated program (or lesson), not a partial diff.
- Put a clear one-sentence “what changed and why” in summary.`;
}
