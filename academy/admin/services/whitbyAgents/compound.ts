import type { WhitbyRefineContext } from "../../actions";
import type { PersistedProgramDraft } from "../catalogPersistence";
import {
  detectContentKind,
  fuzzyHas,
  mentionsLesson,
  mentionsModule,
  wantsRemove,
  wantsRename,
} from "./fuzzy";
import { parseOutlineTarget } from "./locator";

// Splits a compound instruction ("remove lesson 1.2 and add one more lesson")
// into independently-routable clauses so every requested action is executed,
// not just the first one the single-intent router happens to match. The split
// is deliberately conservative: it only fires when at least two clauses are
// genuinely actionable, so ordinary instructions that merely contain the word
// "and" ("add a lesson about variables and constants") are left untouched.

const ACTION_VERBS = [
  "add",
  "create",
  "insert",
  "include",
  "make",
  "append",
  "put",
  "write",
  "remove",
  "delete",
  "drop",
  "eliminate",
  "rename",
  "rewrite",
  "expand",
  "improve",
  "edit",
  "fix",
  "shorten",
  "generate",
  "build",
];

const LEADING_VERB_RE =
  /\b(add|create|insert|include|make|append|put|write|remove|delete|drop|eliminate|rename|rewrite|expand|improve|edit|fix|shorten|generate|build)\b/;

/** Trailing modifiers that describe the prior action — not a second action. */
const RELATION_TAIL =
  /\s+and\s+(?:(?:make\s+it\s+)?(?:related|tied|linked)\s+to|based\s+on|about)\s+(?:that|this|the|it)\s*(?:lesson|module|one|content)?\.?$/i;

const RELATION_FILLER =
  /^(?:add|create|include|make|put|write)?\s*(?:(?:make\s+it\s+)?(?:related|tied|linked)\s+to|based\s+on|about)\s+(?:that|this|the|it)\s*(?:lesson|module|one|content)?\.?$/i;

function hasActionVerb(text: string): boolean {
  return (
    fuzzyHas(text, ACTION_VERBS) ||
    /\bgive me\b|\btake out\b|\bget rid of\b|\bi want\b|\bwant an?\b/i.test(text)
  );
}

function leadingVerb(text: string): string | null {
  return text.toLowerCase().match(LEADING_VERB_RE)?.[1] ?? null;
}

function stripRelationTail(text: string): string {
  return text.replace(RELATION_TAIL, "").trim();
}

function isRelationFiller(text: string): boolean {
  return RELATION_FILLER.test(text.trim());
}

function rawClauses(text: string): string[] {
  return text
    .replace(/\s*[,;]\s*/g, " and ")
    .replace(/\s+&\s+/g, " and ")
    .replace(/\b(?:and then|then|after that|also|as well as|plus)\b/gi, "and")
    .split(/\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isActionable(
  text: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): boolean {
  if (isRelationFiller(text)) return false;
  if (detectContentKind(text) != null) {
    // Bare "lesson" after a carried verb ("add related to that lesson") is not
    // a real second outline action — require a concrete content kind beyond filler.
    const kind = detectContentKind(text);
    if (kind === "reading" && isRelationFiller(text.replace(/\blessons?\b/gi, " ").trim())) {
      return false;
    }
    if (kind === "reading" && !/\b(reading|article|chapter|section)\b/i.test(text) && /\brelated to\b/i.test(text)) {
      return false;
    }
    return true;
  }
  if (
    wantsRemove(text) &&
    (mentionsLesson(text) || mentionsModule(text) || parseOutlineTarget(text, draft, context) != null)
  ) {
    return true;
  }
  return wantsRename(text);
}

export function splitCompoundInstruction(
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): string[] {
  const text = stripRelationTail(instruction.trim());
  if (!text) return [instruction.trim()];

  const parts = rawClauses(text);
  if (parts.length < 2) return [text];

  // Carry the previous action verb into verb-less clauses so "add a quiz and an
  // assignment" becomes ["add a quiz", "add an assignment"].
  let prevVerb = "add";
  const clauses = parts.map((part) => {
    if (hasActionVerb(part)) {
      prevVerb = leadingVerb(part) ?? prevVerb;
      return part;
    }
    return `${prevVerb} ${part}`;
  });

  const actionable = clauses.filter((clause) => isActionable(clause, draft, context));
  if (actionable.length < 2) return [text];
  return actionable;
}
