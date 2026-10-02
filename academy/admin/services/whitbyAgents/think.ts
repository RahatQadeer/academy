/**
 * DeepSeek understand-then-act brain for Whitby.
 *
 * Like GPT: every message is read in conversation context first, rewritten into
 * a clear intent, then classified as answer | clarify | act.
 *
 * Heuristics are only:
 * - undo (instant)
 * - post-validation (commands must not become lesson summaries)
 * - fallback when DeepSeek is down
 */

import "server-only";

import type { WhitbyRefineContext } from "../../actions";
import { generateJson } from "../catalogPipeline/deepseek";
import type { PersistedLesson, PersistedProgramDraft } from "../catalogPersistence";
import { CO_AUTHOR_SYSTEM } from "./coAuthorSystem";
import { conversationPromptBlock } from "./conversationHistory";
import {
  asksAboutLastChange,
  beautifyEditNotes,
  formatEditNotes,
  headingRenameNotes,
  isBeautifyRequest,
  isConversationalAsk,
  isFormatRequest,
  isHeadingRenameRequest,
  isQualityQuestion,
  looksLikeCourseCommand,
  wantsUndoChanges,
} from "./fuzzy";
import { outlineDraft, type WhitbyIntent } from "./types";

export type WhitbyThinkMode = "answer" | "clarify" | "act";

export type WhitbyThinkResult = {
  mode: WhitbyThinkMode;
  intentPhrase: string;
  /** Clear English rewrite of what the instructor wants (for agents / chat). */
  plainIntent: string;
  replyNotes: string;
  intents: WhitbyIntent[];
  count: number;
  lessonType?: PersistedLesson["type"];
  assignmentMode?: "attach" | "insert";
  confidence: number;
};

const ACT_INTENTS: WhitbyIntent[] = [
  "add_lessons",
  "add_module",
  "add_quiz",
  "expand_quiz",
  "add_assignment",
  "add_video",
  "embed_content",
  "edit_lesson",
  "edit_overview",
  "remove_lesson",
  "remove_module",
  "remove_assignment",
  "rename_item",
];

function asActIntent(value: unknown): value is WhitbyIntent {
  return typeof value === "string" && (ACT_INTENTS as string[]).includes(value);
}

function focusJson(context?: WhitbyRefineContext) {
  return {
    focus: context?.focus ?? "program",
    moduleTitle: context?.moduleTitle ?? null,
    lessonTitle: context?.lessonTitle ?? null,
    lessonType: context?.lessonType ?? null,
    moduleIndex: context?.moduleIndex ?? null,
    lessonIndex: context?.lessonIndex ?? null,
    moduleNumber: context?.moduleIndex != null ? context.moduleIndex + 1 : null,
    lessonNumber:
      context?.moduleIndex != null && context.lessonIndex != null
        ? `${context.moduleIndex + 1}.${context.lessonIndex + 1}`
        : null,
  };
}

function enrichActNotes(raw: string, plainIntent: string, intents: WhitbyIntent[]): string {
  if (isBeautifyRequest(raw)) return beautifyEditNotes(raw);
  if (isFormatRequest(raw)) return formatEditNotes(raw);
  if (isHeadingRenameRequest(raw)) return headingRenameNotes(raw);
  if (intents.includes("edit_lesson")) {
    return `${plainIntent || raw}

Apply ONLY this change in the targeted lesson. Do not add lessons. Do not rewrite unrelated paragraphs. Do not reply with a lesson summary — perform the edit.`;
  }
  return plainIntent || raw;
}

function heuristicActFallback(text: string): WhitbyThinkResult | null {
  if (isBeautifyRequest(text)) {
    return {
      mode: "act",
      intentPhrase: "beautify lesson layout",
      plainIntent: text,
      replyNotes: beautifyEditNotes(text),
      intents: ["edit_lesson"],
      count: 1,
      confidence: 0.9,
    };
  }
  if (isFormatRequest(text)) {
    return {
      mode: "act",
      intentPhrase: "format lesson text",
      plainIntent: text,
      replyNotes: formatEditNotes(text),
      intents: ["edit_lesson"],
      count: 1,
      confidence: 0.9,
    };
  }
  if (isHeadingRenameRequest(text)) {
    return {
      mode: "act",
      intentPhrase: "rename lesson heading",
      plainIntent: text,
      replyNotes: headingRenameNotes(text),
      intents: ["edit_lesson"],
      count: 1,
      confidence: 0.9,
    };
  }
  if (looksLikeCourseCommand(text)) {
    return {
      mode: "act",
      intentPhrase: "edit lesson content",
      plainIntent: text,
      replyNotes: enrichActNotes(text, text, ["edit_lesson"]),
      intents: ["edit_lesson"],
      count: 1,
      confidence: 0.65,
    };
  }
  return null;
}

/**
 * Ask DeepSeek to understand the latest message before any mutation.
 * Returns null only when the model call fails AND no heuristic act applies.
 */
export async function thinkWhitbyMessage(
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): Promise<WhitbyThinkResult | null> {
  const text = instruction.trim();
  if (!text) return null;

  if (wantsUndoChanges(text)) {
    return {
      mode: "answer",
      intentPhrase: "undo last change",
      plainIntent: "Undo the last Whitby edit",
      replyNotes:
        "The instructor wants to undo. Tell them to use Undo above the chat (or say undo again). Do not delete a lesson.",
      intents: [],
      count: 1,
      confidence: 1,
    };
  }

  if (asksAboutLastChange(text)) {
    return {
      mode: "answer",
      intentPhrase: "explain last change",
      plainIntent: "Explain what Whitby changed last and where to find it",
      replyNotes: text,
      intents: [],
      count: 1,
      confidence: 1,
    };
  }

  try {
    const conversation = conversationPromptBlock(context?.recentChat, { windowSize: 16 });
    const response = await generateJson<{
      mode?: WhitbyThinkMode | "chat" | "question";
      intentPhrase?: string;
      plainIntent?: string;
      clarify?: string | null;
      reply?: string | null;
      intents?: string[];
      count?: number;
      notes?: string;
      lessonType?: PersistedLesson["type"];
      assignmentMode?: "attach" | "insert" | null;
      confidence?: number;
    }>(
      `You are Whitby’s reasoning brain (DeepSeek). Behave like GPT: messy instructor English is normal — typos, slang, broken word order. Your job is to UNDERSTAND, then choose answer / clarify / act.

${CO_AUTHOR_SYSTEM}

## Process (mandatory, every message)
1. Read the FULL recent conversation.
2. Read the latest instructor message carefully (ignore typos).
3. Rewrite it in your head as one clear sentence: plainIntent.
4. Decide mode:
   - answer — they asked a question / want explanation / meta (“what did you do?”). Do NOT change the draft. Do NOT dump a lesson synopsis unless they asked what the lesson is about.
   - clarify — you need one missing fact (which lesson / which heading). Ask ONE short question. Do not mutate.
   - act — they clearly want the course changed. Set intents + notes for specialists.
5. Return JSON only.

## Critical anti-patterns (never do these)
- NEVER treat a COMMAND as a request for a lesson summary.
- NEVER answer “1.1 is a reading lesson in …” when they said change / rename / heading / bold / fix / add / remove / improve.
- NEVER add a new lesson when they asked to rename a heading or format text.
- NEVER invent content they did not ask for.
- If plainIntent is an edit, mode MUST be "act" (or "clarify" if the target lesson is unknown).

## Messy-English examples → correct mode
- "in module 1 lesson 1 a component is just a function heading change name"
  → act, edit_lesson, plainIntent: "In lesson 1.1, rename the heading to ‘A component is just a function’."
- "make key takeway bold in 1.1"
  → act, edit_lesson, format-only bold on Key takeaways
- "what you do?"
  → answer (explain; no edit)
- "add 3 quiz questions to this"
  → act, expand_quiz (or add_quiz)
- "why is 1.1 so thin?"
  → answer (diagnose only)
- "deepen 1.1"
  → act, edit_lesson

## Intents (act only)
add_lessons | add_module | add_quiz | expand_quiz | add_assignment | add_video | embed_content | edit_lesson | edit_overview | remove_lesson | remove_module | remove_assignment | rename_item
Never put answer/rewrite_program in intents.

Return JSON:
{
  "mode": "answer"|"clarify"|"act",
  "intentPhrase": "≤8 words",
  "plainIntent": "one clear English sentence of what they want",
  "clarify": string|null,
  "reply": string|null,
  "intents": [],
  "count": number,
  "notes": "precise instructions for the edit agent when mode=act",
  "lessonType": "reading"|"scenario"|"video"|"quiz"|"assignment"|"resource"|null,
  "assignmentMode": "attach"|"insert"|null,
  "confidence": 0.0-1.0
}`,
      `Course: ${draft.name}
Open focus (use when they say this/current/selected): ${JSON.stringify(focusJson(context))}
${conversation ? `\n${conversation}\n` : ""}
Outline:
${JSON.stringify(outlineDraft(draft))}

Latest instructor message (highest priority — understand THIS):
"""
${text}
"""

Command-signal hint (heuristic, not authoritative): ${looksLikeCourseCommand(text) ? "LIKELY_COMMAND" : "MAYBE_QUESTION_OR_CHAT"}

Think like GPT. Return the JSON.`,
      {
        task: "route",
        temperature: 0.05,
        maxTokens: 560,
        timeoutMs: 18_000,
        stream: true,
        label: "whitby-think",
      },
    );

    if (!response) {
      return heuristicActFallback(text);
    }

    let mode: WhitbyThinkMode =
      response.mode === "act" || response.mode === "clarify" || response.mode === "answer"
        ? response.mode
        : response.mode === "chat" || response.mode === "question"
          ? "answer"
          : "answer";

    const clarify = response.clarify?.trim() || null;
    if (clarify && mode !== "act") mode = "clarify";

    let intents = (response.intents ?? []).filter(asActIntent);
    const plainIntent = (response.plainIntent || response.intentPhrase || text).trim();

    // Commands must not become lesson summaries.
    if (looksLikeCourseCommand(text) && mode === "answer") {
      if (clarify) {
        mode = "clarify";
      } else {
        mode = "act";
        if (intents.length === 0) intents = ["edit_lesson"];
      }
    }

    if (mode === "act" && intents.length === 0) {
      mode = clarify ? "clarify" : looksLikeCourseCommand(text) ? "act" : "answer";
      if (mode === "act") intents = ["edit_lesson"];
    }

    // Hard rails still win when we know the edit flavor.
    if (mode === "act") {
      if (isBeautifyRequest(text)) intents = ["edit_lesson"];
      if (isFormatRequest(text)) intents = ["edit_lesson"];
      if (isHeadingRenameRequest(text)) intents = ["edit_lesson"];
    }

    // True questions stay answers even if a command word slipped in awkwardly.
    if (
      (isConversationalAsk(text) || isQualityQuestion(text)) &&
      !isBeautifyRequest(text) &&
      !isFormatRequest(text) &&
      !isHeadingRenameRequest(text) &&
      !/\b(heading|bold|italic|beautif|definition cards?)\b/i.test(text)
    ) {
      mode = "answer";
      intents = [];
    }

    const confidence =
      typeof response.confidence === "number" && Number.isFinite(response.confidence)
        ? Math.min(1, Math.max(0, response.confidence))
        : mode === "act"
          ? 0.75
          : 0.85;

    if (mode === "act" && confidence < 0.4 && !looksLikeCourseCommand(text)) {
      mode = "clarify";
      intents = [];
    }

    const replyNotes =
      mode === "clarify"
        ? clarify ||
          response.reply?.trim() ||
          "I want to get this right — which lesson should I change, and what exactly should change?"
        : mode === "answer"
          ? response.reply?.trim() || plainIntent || text
          : enrichActNotes(text, response.notes?.trim() || plainIntent, intents);

    return {
      mode,
      intentPhrase: (response.intentPhrase || mode).trim().slice(0, 80),
      plainIntent,
      replyNotes,
      intents: mode === "act" ? intents : [],
      count: Math.min(8, Math.max(1, Math.round(Number(response.count) || 1))),
      lessonType: response.lessonType ?? undefined,
      assignmentMode:
        response.assignmentMode === "attach" || response.assignmentMode === "insert"
          ? response.assignmentMode
          : undefined,
      confidence,
    };
  } catch (error) {
    console.info(
      `[whitby-think] failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return heuristicActFallback(text);
  }
}
