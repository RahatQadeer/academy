/**
 * Universal intent understanding for Whitby.
 * Runs before routing so every message — typos, slang, corrections,
 * follow-ups, and ambiguous asks — is interpreted against scope + chat history.
 */

import type { WhitbyRefineContext } from "../../actions";
import type { PersistedProgramDraft } from "../catalogPersistence";
import {
  detectContentKind,
  isBeautifyRequest,
  isConversationalAsk,
  isDepthTopic,
  isFormatRequest,
  isHeadingRenameRequest,
  isQualityQuestion,
  wantsDeeperContent,
  wantsProgramOverview,
  wantsUndoChanges,
} from "./fuzzy";
import { parseOutlineTarget } from "./locator";

export type IntentScope = "program" | "module" | "lesson" | "content" | "chat" | "unknown";

export type UnderstoodIntent = {
  raw: string;
  /** Instruction agents should act on (may rewrite follow-ups / corrections). */
  normalized: string;
  scope: IntentScope;
  isCorrection: boolean;
  isFollowUp: boolean;
  isUndo: boolean;
  /** When set, route to chat with this clarifying question — do not mutate. */
  clarify?: string;
  confidence: number;
  hints: {
    preferOverview?: boolean;
    preferAnswer?: boolean;
    /** Do not treat the open lesson as the target. */
    ignoreLessonFocus?: boolean;
  };
};

function lastUserTurns(context?: WhitbyRefineContext, n = 4): string[] {
  return (context?.recentChat ?? [])
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content.trim())
    .filter(Boolean)
    .slice(-n);
}

function lastWhitbyTurn(context?: WhitbyRefineContext): string {
  const turns = context?.recentChat ?? [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i]?.role === "whitby" && turns[i]?.content.trim()) {
      return turns[i].content.trim();
    }
  }
  return "";
}

/** Light cleanup — keep meaning, fix common chat noise. */
export function normalizeMessyInstruction(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bi\s+amm\b/gi, "I am")
    .replace(/\bim\b/gi, "I'm")
    .replace(/\bwana\b|\bwanna\b/gi, "want to")
    .replace(/\bpls\b|\bplz\b/gi, "please")
    .replace(/\bu\b/gi, "you")
    .replace(/\br\b/gi, "are")
    .replace(/\bcuz\b|\bbecause\b/gi, "because")
    .replace(/\btho\b/gi, "though")
    .replace(/\bn\b(?=\s)/gi, "and")
    .replace(/[!?]{2,}/g, "?")
    .trim();
}

function isShortAffirmation(text: string): boolean {
  return /^(yes|yeah|yep|yup|ok|okay|sure|do it|go ahead|apply|apply it|please do|that one|this one|the first|the second|correct|right)\.?$/i.test(
    text.trim(),
  );
}

function isCorrection(text: string): boolean {
  return (
    /\b(no|nope|wrong|not that|i meant|i mean|i'm talking|im talking|talking about|rather|instead)\b/i.test(
      text,
    ) || /\bnot\s+(a\s+|the\s+|my\s+)?(lesson|module|quiz|assignment|video)\b/i.test(text)
  );
}

function deniesLessonScope(text: string): boolean {
  if (isDepthTopic(text) || wantsDeeperContent(text) || /\b(course|program)\s+content\b/i.test(text)) {
    return false;
  }
  return (
    /\bnot\s+(a\s+|the\s+|my\s+)?lesson\b/i.test(text) ||
    /\b(course|program)\s+(name|title|heading)\b/i.test(text) ||
    (/\btalking about\b.{0,40}\b(course|program)\b/i.test(text) &&
      !/\bcontent\b|\bdepth\b|\blesson\b/i.test(text))
  );
}

function deniesModuleScope(text: string): boolean {
  return /\bnot\s+(a\s+|the\s+|my\s+)?module\b/i.test(text);
}

function listQuizLessons(draft: PersistedProgramDraft): string[] {
  const labels: string[] = [];
  draft.modules.forEach((module, mi) => {
    module.lessons.forEach((lesson, li) => {
      if (lesson.type === "quiz" || lesson.quiz) {
        labels.push(`${mi + 1}.${li + 1} “${lesson.title}”`);
      }
    });
  });
  return labels;
}

function listAssignmentLessons(draft: PersistedProgramDraft): string[] {
  const labels: string[] = [];
  draft.modules.forEach((module, mi) => {
    module.lessons.forEach((lesson, li) => {
      if (lesson.type === "assignment" || lesson.assignment) {
        labels.push(`${mi + 1}.${li + 1} “${lesson.title}”`);
      }
    });
  });
  return labels;
}

/**
 * Resolve pronouns / short replies using recent chat so Whitby doesn't wait
 * for the instructor to repeat themselves.
 */
function resolveFollowUp(
  text: string,
  context?: WhitbyRefineContext,
): { normalized: string; isFollowUp: boolean } {
  const priorUsers = lastUserTurns(context);
  // The latest prior user ask (current message is not in recentChat yet).
  const previous = priorUsers[priorUsers.length - 1];
  if (!previous) return { normalized: text, isFollowUp: false };

  if (isShortAffirmation(text)) {
    const bot = lastWhitbyTurn(context);
    const deepenId =
      bot.match(/\bdeepen\s+(\d{1,2}\.\d{1,2})\b/i)?.[1] ??
      bot.match(/\brewrite\s+(\d{1,2}\.\d{1,2})\b/i)?.[1];
    if (/\b(deepen|rewrite|in-?depth|in depth)\b/i.test(bot) && /\b(reply|say|want me|shall i|should i)\b/i.test(bot)) {
      return {
        normalized: deepenId ? `deepen ${deepenId}` : "deepen this lesson",
        isFollowUp: true,
      };
    }
    if (previous) return { normalized: previous, isFollowUp: true };
    return { normalized: text, isFollowUp: true };
  }

  // "do that but for module 2" / "same for the quiz"
  if (/^(same|do (the )?same|that but|same but|also)\b/i.test(text) || /\bfor (that|this|it)\b/i.test(text)) {
    return { normalized: `${previous} — follow-up: ${text}`, isFollowUp: true };
  }

  // Correction that still needs the prior ask: "no, the course name"
  if (isCorrection(text) && text.length < 120 && !/\b(add|remove|delete|rename|improve)\b/i.test(text)) {
    return {
      normalized: `${previous}. Correction: ${text}`,
      isFollowUp: true,
    };
  }

  return { normalized: text, isFollowUp: false };
}

function detectAmbiguity(
  text: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): string | undefined {
  if (isQualityQuestion(text) || isDepthTopic(text)) return undefined;
  const kind = detectContentKind(text);
  const target = parseOutlineTarget(text, draft, context);
  const hasLessonFocus = context?.focus === "lesson" && context.lessonIndex != null;
  const saidThis = /\b(this|current|selected)\b/i.test(text);
  const named = target?.lessonIndex != null || /\b\d{1,2}\.\d{1,2}\b/.test(text);

  // "the quiz" / "help with the quiz" with multiple quizzes and no clear target
  if (kind === "quiz" || /\bthe quiz\b|\bthat quiz\b|\bhelp with.{0,20}quiz\b/i.test(text)) {
    const quizzes = listQuizLessons(draft);
    const focusedIsQuiz =
      hasLessonFocus &&
      (context?.lessonType === "quiz" ||
        Boolean(draft.modules[context!.moduleIndex!]?.lessons[context!.lessonIndex!]?.quiz));
    const hasClearQuizTarget = named || saidThis || focusedIsQuiz;
    if (quizzes.length > 1 && !hasClearQuizTarget) {
      return `Which quiz should I use — ${quizzes.slice(0, 4).join(", ")}${quizzes.length > 4 ? ", …" : ""}? Select it in the outline or say the number (e.g. “add 3 questions to 1.4”).`;
    }
    if (quizzes.length === 0 && /\b(expand|more|add).{0,20}question/i.test(text)) {
      return "There isn’t a quiz in this course yet. Say “add a quiz” (optionally after a lesson number) and I’ll create one.";
    }
  }

  // "the assignment" with multiple and no focus
  if (kind === "assignment" && !named && !saidThis && !hasLessonFocus) {
    const assignments = listAssignmentLessons(draft);
    if (assignments.length > 1) {
      return `Which assignment — ${assignments.slice(0, 4).join(", ")}? Or select a lesson and say “add an assignment to this”.`;
    }
  }

  // Bare improve/rewrite/fix with no lesson selected and no number
  if (
    /\b(improve|rewrite|fix|polish|tighten|expand)\b/i.test(text) &&
    !named &&
    !saidThis &&
    !hasLessonFocus &&
    !wantsProgramOverview(text) &&
    kind == null
  ) {
    return "Which lesson should I improve? Select it in the outline and say “improve this”, or name it (e.g. “improve 2.1”).";
  }

  // Remove without a target
  if (
    /\b(remove|delete|drop)\b/i.test(text) &&
    !wantsUndoChanges(text) &&
    !named &&
    !saidThis &&
    !/\blesson\b|\bmodule\b|\bassignment\b|\bquiz\b|\bvideo\b/i.test(text)
  ) {
    return "What should I remove — a lesson number (e.g. 1.3), a module, an assignment, or use Undo for my last edit?";
  }

  return undefined;
}

function inferScope(text: string, context?: WhitbyRefineContext): IntentScope {
  if (isQualityQuestion(text) || isDepthTopic(text) || wantsDeeperContent(text)) {
    return isQualityQuestion(text) ? "chat" : "lesson";
  }
  if (wantsProgramOverview(text) || deniesLessonScope(text)) return "program";
  if (deniesModuleScope(text)) return "lesson";
  if (/\b(module|section|unit)\b/i.test(text) && !/\blesson\b|\b\d{1,2}\.\d{1,2}\b/i.test(text)) {
    return "module";
  }
  if (/\b(assignment|quiz|video|scenario|questions?)\b/i.test(text)) return "content";
  if (/\blesson\b|\b\d{1,2}\.\d{1,2}\b|\b(this|current|selected)\b/i.test(text)) return "lesson";
  if (/\b(how many|what can you|what you do|what did you|help|outline|list)\b/i.test(text)) return "chat";
  if (context?.focus === "overview") return "program";
  if (context?.focus === "lesson") return "lesson";
  return "unknown";
}

/**
 * Understand one instructor message in context. Always call this before routing.
 */
export function understandInstruction(
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): UnderstoodIntent {
  const raw = instruction.trim();
  if (!raw) {
    return {
      raw,
      normalized: raw,
      scope: "unknown",
      isCorrection: false,
      isFollowUp: false,
      isUndo: false,
      clarify: "Tell me what to change — for example “rename the course”, “add a quiz after 1.2”, or “improve this”.",
      confidence: 0.2,
      hints: { preferAnswer: true },
    };
  }

  const cleaned = normalizeMessyInstruction(raw);
  const undo = wantsUndoChanges(cleaned);
  const correction = isCorrection(cleaned);
  const { normalized: followed, isFollowUp } = resolveFollowUp(cleaned, context);
  let normalized = followed;

  if (isConversationalAsk(cleaned) || isConversationalAsk(normalized)) {
    return {
      raw,
      normalized: cleaned,
      scope: "chat",
      isCorrection: correction,
      isFollowUp,
      isUndo: undo,
      confidence: 0.95,
      hints: { preferAnswer: true, ignoreLessonFocus: true },
    };
  }

  if (isBeautifyRequest(cleaned) || isBeautifyRequest(normalized)) {
    return {
      raw,
      normalized: cleaned,
      scope: "lesson",
      isCorrection: correction,
      isFollowUp,
      isUndo: undo,
      confidence: 0.9,
      hints: { preferAnswer: false },
    };
  }

  if (isFormatRequest(cleaned) || isFormatRequest(normalized)) {
    return {
      raw,
      normalized: cleaned,
      scope: "lesson",
      isCorrection: correction,
      isFollowUp,
      isUndo: undo,
      confidence: 0.9,
      hints: { preferAnswer: false },
    };
  }

  if (isHeadingRenameRequest(cleaned) || isHeadingRenameRequest(normalized)) {
    return {
      raw,
      normalized: cleaned,
      scope: "lesson",
      isCorrection: correction,
      isFollowUp,
      isUndo: undo,
      confidence: 0.92,
      hints: { preferAnswer: false },
    };
  }

  // Corrections that deny lesson scope → force program overview wording.
  if (deniesLessonScope(cleaned) || (wantsProgramOverview(cleaned) && !wantsDeeperContent(cleaned))) {
    const prior = lastUserTurns(context).slice(-2)[0];
    if (correction && prior && wantsProgramOverview(prior)) {
      normalized = prior;
    } else if (wantsProgramOverview(cleaned) || deniesLessonScope(cleaned)) {
      normalized = cleaned;
    }
    return {
      raw,
      normalized,
      scope: "program",
      isCorrection: correction,
      isFollowUp,
      isUndo: undo,
      confidence: 0.92,
      hints: {
        preferOverview: true,
        ignoreLessonFocus: true,
        preferAnswer: undo && !wantsProgramOverview(cleaned),
      },
    };
  }

  if (undo && !/\b(lesson|module|assignment|quiz)\b/i.test(cleaned)) {
    return {
      raw,
      normalized: cleaned,
      scope: "chat",
      isCorrection: correction,
      isFollowUp,
      isUndo: true,
      confidence: 0.95,
      hints: { preferAnswer: true, ignoreLessonFocus: true },
      clarify: undefined,
    };
  }

  const scope = inferScope(normalized, context);
  const clarify = detectAmbiguity(normalized, draft, context);

  // If Whitby just asked a clarifying question and user replied briefly, fold in.
  const lastBot = lastWhitbyTurn(context);
  if (
    isFollowUp &&
    isShortAffirmation(cleaned) &&
    /\?\s*$/.test(lastBot) &&
    lastUserTurns(context).length >= 1
  ) {
    const priorAsk = lastUserTurns(context).slice(-2)[0] ?? normalized;
    normalized = priorAsk;
  }

  const confidence = clarify ? 0.45 : isFollowUp || correction ? 0.75 : scope !== "unknown" ? 0.8 : 0.55;

  return {
    raw,
    normalized,
    scope,
    isCorrection: correction,
    isFollowUp,
    isUndo: undo,
    clarify,
    confidence,
    hints: {
      preferOverview: scope === "program" && !wantsDeeperContent(normalized),
      preferAnswer: scope === "chat" || isQualityQuestion(normalized),
      ignoreLessonFocus: scope === "program" || scope === "module" || Boolean(clarify),
    },
  };
}

/** Context with lesson focus cleared when the user clearly meant something else. */
export function contextForUnderstood(
  context: WhitbyRefineContext | undefined,
  understood: UnderstoodIntent,
): WhitbyRefineContext | undefined {
  if (!context) return context;
  if (!understood.hints.ignoreLessonFocus) return context;
  return {
    ...context,
    focus: understood.hints.preferOverview ? "overview" : "program",
    moduleIndex: undefined,
    lessonIndex: undefined,
    lessonTitle: undefined,
    lessonType: undefined,
    lessonSummary: undefined,
    lessonExcerpt: undefined,
  };
}
