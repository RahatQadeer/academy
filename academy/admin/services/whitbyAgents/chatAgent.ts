import "server-only";

import type { WhitbyRefineContext } from "../../actions";
import type { PersistedProgramDraft } from "../catalogPersistence";
import { generateText } from "../catalogPipeline/deepseek";
import { CO_AUTHOR_SYSTEM } from "./coAuthorSystem";
import { conversationPromptBlock, type ChatTurn } from "./conversationHistory";
import {
  asksAboutLastChange,
  isConversationalAsk,
  isDepthTopic,
  isHeadingRenameRequest,
  isQualityQuestion,
  looksLikeCourseCommand,
  wantsDeeperContent,
  wantsUndoChanges,
} from "./fuzzy";
import { lessonLabel, parseOutlineTarget } from "./locator";
import { outlineDraft, type OrchestratedRefine, type WhitbyPlan } from "./types";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function resolveTalkLesson(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext,
): { moduleIndex: number; lessonIndex: number } | null {
  const target = parseOutlineTarget(instruction, draft, context);
  if (target?.lessonIndex != null) {
    return { moduleIndex: target.moduleIndex, lessonIndex: target.lessonIndex };
  }
  if (context?.focus === "lesson" && context.moduleIndex != null && context.lessonIndex != null) {
    return { moduleIndex: context.moduleIndex, lessonIndex: context.lessonIndex };
  }
  return null;
}

/** Diagnose thin content without rewriting — questions stay questions. */
function diagnoseDepth(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext,
): string | null {
  if (!isQualityQuestion(instruction) && !(isDepthTopic(instruction) && !wantsDeeperContent(instruction))) {
    return null;
  }

  const loc = resolveTalkLesson(draft, instruction, context);
  if (!loc) {
    return "Which lesson feels thin? Name it (module 1 lesson 1, or 1.1) and I’ll tell you what’s missing. I won’t rewrite until you ask.";
  }

  const lesson = draft.modules[loc.moduleIndex]?.lessons[loc.lessonIndex];
  if (!lesson) {
    return "I couldn’t find that lesson in the outline. Check the module and lesson number.";
  }

  const label = lessonLabel(draft, loc.moduleIndex, loc.lessonIndex);
  const id = `${loc.moduleIndex + 1}.${loc.lessonIndex + 1}`;
  const body = lesson.contentBody || "";
  const words = wordCount(body);
  const gaps: string[] = [];

  if (words < 80) gaps.push("the body is almost empty");
  else if (words < 400) gaps.push(`the body is only about ${words} words, so it reads as an overview`);
  else if (words < 750) gaps.push(`the body is about ${words} words — short for a full lesson`);

  if (!/\bscenario\b/i.test(body) || !/\bdecision\s*:/i.test(body)) {
    gaps.push("there’s no learner Scenario with a Decision");
  }
  if (!/```exercise/i.test(body)) gaps.push("there’s no interactive exercise");
  if (!/\b\d+(\.\d+)?\s*%|\b\d+\s+(percent|metres?|meters?|hours?|seams?|yards?|dollars?)\b/i.test(body)) {
    gaps.push("there’s no worked example with real numbers");
  }

  if (gaps.length === 0 && words >= 750) {
    return `${label} already has a substantial body (~${words} words). If it still feels thin, tell me what’s missing — more production math, another case, or a different lesson. I haven’t changed anything.`;
  }

  const reason = gaps.length ? gaps.join("; ") : "it stays at the summary level instead of teaching the mechanism";
  return `${label} feels thin because ${reason}. I haven’t changed it. Reply “deepen ${id}” if you want me to rewrite that lesson in depth.`;
}

function asChat(draft: PersistedProgramDraft, summary: string): OrchestratedRefine {
  return { ...draft, summary, mutated: false };
}

function focusBlock(context?: WhitbyRefineContext): string {
  if (!context) return "Focus: whole program";
  if (context.focus === "lesson") {
    return [
      `Focus: selected lesson`,
      context.moduleTitle ? `Module: ${context.moduleTitle}` : "",
      context.lessonTitle ? `Lesson: ${context.lessonTitle}` : "",
      context.lessonType ? `Type: ${context.lessonType}` : "",
      context.moduleIndex != null && context.lessonIndex != null
        ? `Outline id: ${context.moduleIndex + 1}.${context.lessonIndex + 1}`
        : "",
      context.lessonSummary ? `Summary: ${context.lessonSummary}` : "",
      context.lessonExcerpt ? `Excerpt:\n${context.lessonExcerpt.slice(0, 900)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (context.focus === "overview") return "Focus: program overview (title/description)";
  if (context.focus === "module") {
    return `Focus: module${context.moduleTitle ? ` “${context.moduleTitle}”` : ""}`;
  }
  return "Focus: whole program";
}

function lastDoneSummary(recentChat?: ChatTurn[]): string | null {
  const turns = recentChat ?? [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const turn = turns[i];
    if (turn?.role !== "whitby") continue;
    const text = turn.content.trim();
    const done = text.match(/^Done\s*[—–-]\s*(.+?)(?:\s+Your changes are saved|\s+You can undo|$)/i);
    if (done?.[1]) return done[1].trim().replace(/\.\s*$/, "");
    if (/^(added|updated|expanded|renamed|removed|rewrote|improved)\b/i.test(text)) {
      return text.split(/Your changes are saved/i)[0]?.trim().replace(/\.\s*$/, "") || text;
    }
  }
  return null;
}

function explainLastChange(recentChat?: ChatTurn[]): string {
  const summary = lastDoneSummary(recentChat);
  if (!summary) {
    return "I don’t have a recent edit in this chat to point to. After I change the lesson, ask “what did you change?” and I’ll repeat it. Open the lesson in the outline (e.g. 1.1) and check the section I named in the Done message.";
  }
  return `Here’s what I changed last: ${summary}. Open that lesson in the outline on the left and scroll to the section I named — the new text is there. If you still don’t see it, click the lesson again to refresh the editor.`;
}

function localAnswer(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext,
): string | null {
  const text = instruction.trim();
  const lower = text.toLowerCase();
  const diagnose = diagnoseDepth(draft, text, context);
  const lessonCount = draft.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const questionCount = draft.modules.reduce(
    (sum, module) =>
      sum + module.lessons.reduce((inner, lesson) => inner + (lesson.quiz?.questions.length ?? 0), 0),
    0,
  );

  if (diagnose) {
    return diagnose;
  }

  // “Where are the changes?” / “what did you change?” — never Undo.
  if (asksAboutLastChange(text)) {
    return explainLastChange(context?.recentChat);
  }

  // Explicit undo only — do not match the word “undo” inside agent notes.
  if (wantsUndoChanges(text)) {
    return "Use the Undo button above the chat — or say “undo” again and I’ll roll back the last Whitby edit.";
  }

  // Commands should never be answered with a lesson blurb — routing should have
  // acted. If we landed in chat anyway, ask one clarifying line instead.
  if (looksLikeCourseCommand(text) || isHeadingRenameRequest(text)) {
    return "Got it — you want a change in the course. Say the lesson number (e.g. 1.1) and the exact edit (rename heading to …, definition cards, beautify this, bold …, add a quiz…), and I’ll do that next.";
  }

  if (
    isConversationalAsk(text) ||
    /what can you (do|help)|how (do i|to) use|\bcapabilities\b/.test(lower) ||
    /\bwhat (did|do|are) you\b|\bwhat you do\b|\bdid you (just )?(do|add)\b/.test(lower)
  ) {
    return "I read your message, then either answer or edit the course. Try: rename a heading in 1.1, put definitions in cards, beautify this lesson, bold Key takeaways, add a quiz, or “improve this”. Ask “what did you change?” after an edit and I’ll point to it.";
  }

  if (/how many (modules|sections|units)/.test(lower)) {
    return `This course has ${draft.modules.length} module${draft.modules.length === 1 ? "" : "s"}.`;
  }
  if (/how many lessons/.test(lower)) {
    return `This course has ${lessonCount} lesson${lessonCount === 1 ? "" : "s"} across ${draft.modules.length} modules.`;
  }
  if (/how many (questions|quiz)/.test(lower)) {
    return `There are ${questionCount} quiz question${questionCount === 1 ? "" : "s"} in the current draft.`;
  }

  if (/^(hi|hello|hey|thanks|thank you|yo)\b/.test(lower)) {
    const tip =
      context?.focus === "lesson" && context.lessonTitle
        ? ` You’re on “${context.lessonTitle}” — try “beautify this”, “make definitions cards”, or “rename the course”.`
        : " Ask me to rename the course, add a quiz, or open a lesson and say “beautify this”.";
    return `Ready when you are.${tip}`;
  }

  if (/^(yes|yeah|yep|ok|okay|sure|do it|go ahead)\.?$/i.test(text.trim())) {
    return "Got it — tell me the action in one line if Undo already cleared things, e.g. “rename the course to Java Foundations” or “add 3 questions to this quiz”.";
  }

  if (
    /\bwhich\b|\bhelp with\b|\bcan you\b/i.test(lower) &&
    /\bquiz\b/i.test(lower) &&
    context?.focus !== "lesson"
  ) {
    return null; // let model / clarify path handle
  }

  if (
    context?.focus === "lesson" &&
    context.lessonTitle &&
    /^(what|what's|whats|describe|show|tell me about)\b/i.test(lower) &&
    /\b(this|current|selected)\b/i.test(lower) &&
    !/\b(change|rename|heading|bold|improve|add|remove)\b/i.test(lower)
  ) {
    const bits = [
      `Selected: ${
        context.moduleIndex != null && context.lessonIndex != null
          ? `${context.moduleIndex + 1}.${context.lessonIndex + 1} `
          : ""
      }“${context.lessonTitle}”${context.lessonType ? ` (${context.lessonType})` : ""}.`,
    ];
    if (context.lessonSummary) bits.push(context.lessonSummary);
    return bits.join(" ");
  }

  const target = parseOutlineTarget(text, draft, context);
  if (
    target?.lessonIndex != null &&
    /^(what|what's|whats|describe|show|tell me about)\b/i.test(lower) &&
    !/\b(change|rename|heading|bold|improve|add|remove)\b/i.test(lower)
  ) {
    const module = draft.modules[target.moduleIndex];
    const lesson = module.lessons[target.lessonIndex];
    const bits = [
      `${lessonLabel(draft, target.moduleIndex, target.lessonIndex)} is a ${lesson.type} lesson in “${module.title}”.`,
    ];
    if (lesson.contentSummary) bits.push(lesson.contentSummary);
    if (lesson.quiz?.questions.length) bits.push(`It has ${lesson.quiz.questions.length} quiz questions.`);
    if (lesson.assignment) bits.push("It already has an assignment.");
    return bits.join(" ");
  }

  if (/\b(list|outline|what's in|whats in|show (me )?the (course|modules))\b/.test(lower)) {
    const lines = draft.modules.map(
      (module, moduleIndex) =>
        `${moduleIndex + 1}. ${module.title} (${module.lessons.length} lessons)`,
    );
    return `Here’s the outline:\n${lines.join("\n")}`;
  }

  return null;
}

export async function runChatAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
  context?: WhitbyRefineContext,
): Promise<OrchestratedRefine> {
  const started = Date.now();
  const local = localAnswer(draft, plan.notes, context);
  if (local) {
    console.info(`[whitby-chat] local=true total=${Date.now() - started}ms`);
    return asChat(draft, local);
  }

  try {
    const conversation = conversationPromptBlock(context?.recentChat, { windowSize: 12 });
    const reply = (
      await generateText(
        `${CO_AUTHOR_SYSTEM}

You are answering in chat only — do not claim you changed the draft.
Reply in plain text (no JSON). Be like GPT: understand messy English, answer the actual ask.
Never start with "Done —". Never invent edits.
Never dump a lesson synopsis (“1.1 is a reading lesson in …”) unless they explicitly asked what the lesson is / describe / tell me about it.
If their message looks like a command (change, rename, heading, bold, add, remove, fix) but arrived in chat, ask one short clarifying question — do not summarize the lesson.
Keep answers short and human.`,
        `Program: ${draft.name}
${focusBlock(context)}
${conversation ? `\n${conversation}\n` : ""}
Outline:
${JSON.stringify(outlineDraft(draft))}

Latest instructor message (highest priority):
${plan.notes}

Respond to that latest message now.`,
        {
          task: "chat",
          temperature: 0.4,
          maxTokens: 320,
          timeoutMs: 10_000,
          stream: true,
          label: "whitby-chat",
        },
      )
    )
      .trim()
      .replace(/^["']|["']$/g, "");

    console.info(`[whitby-chat] local=false total=${Date.now() - started}ms`);
    return asChat(
      draft,
      reply ||
        "I can add or adjust outline items, or draft quizzes, videos, and assignments. Open a lesson and try “improve this”, or say “add a quiz”.",
    );
  } catch {
    console.info(`[whitby-chat] error total=${Date.now() - started}ms`);
    return asChat(
      draft,
      "I can add or adjust the outline without rewriting the course. Try “add a quiz”, or open a lesson and ask me to improve it.",
    );
  }
}
