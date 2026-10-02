import type { WhitbyRefineContext } from "../../actions";

// Pure module (no "server-only") so the Phase-2 approval UI can reuse the same
// risk labels for badges without pulling server code into the client bundle.

export type RiskLevel = "low" | "medium" | "high";

export type RiskAssessment = {
  level: RiskLevel;
  requiresApproval: boolean;
  reasons: string[];
};

const HIGH_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\b(delete|remove|drop|get rid of|take out|eliminate)\b.*\b(module|section|unit)s?\b/i, reason: "Removes a module and its lessons" },
  { re: /\b(delete|remove|drop)\b.*\b(program|course)\b(?!\s+(name|title|heading))/i, reason: "Removes the whole program" },
  { re: /\b(publish|go live|make (it )?live)\b/i, reason: "Publishes content to learners" },
  { re: /\b(rebuild|restructure|reshape|start over|rewrite (the )?(whole |entire )?(program|course))\b/i, reason: "Major curriculum restructuring" },
  { re: /\b(every|all)\b.{0,20}\b(lesson|module|quiz|assignment)s?\b/i, reason: "Bulk change across many items" },
  { re: /\ball of (the|them)\b/i, reason: "Bulk change across many items" },
];

const MEDIUM_PATTERNS: { re: RegExp; reason: string }[] = [
  // "remove changes" is undo — not a destructive outline delete.
  {
    re: /\b(delete|remove|drop|take out|get rid of|eliminate)\b(?![\s\S]{0,24}\b(changes|edits|plan)\b)/i,
    reason: "Removes an item",
  },
  // Program / module renames need confirm. In-lesson heading tweaks stay low-risk (auto-apply).
  {
    re: /\brename\b.{0,48}\b(program|course)\b|\b(program|course)\b.{0,40}\b(rename|retitle|title)\b/i,
    reason: "Renames the program",
  },
  {
    re: /\brename\b.{0,48}\bmodules?\b|\bmodules?\b.{0,40}\brename\b/i,
    reason: "Renames a module",
  },
  {
    re: /\bchange (the )?(program|course) (title|name)\b/i,
    reason: "Renames the program",
  },
  { re: /\b(description|overview|category)\b/i, reason: "Edits program-level metadata" },
];

/**
 * Classify how risky an instruction is so the orchestrator can decide whether
 * to auto-apply (low) or require an explicit [Apply] confirmation (medium/high).
 * Editing already-published content is always elevated to at least high because
 * it affects live learners.
 */
export function classifyRisk(
  instruction: string,
  context?: WhitbyRefineContext & { programStatus?: string },
): RiskAssessment {
  const text = instruction.trim();
  const reasons: string[] = [];
  let level: RiskLevel = "low";

  for (const { re, reason } of HIGH_PATTERNS) {
    if (re.test(text)) {
      level = "high";
      reasons.push(reason);
    }
  }

  if (level !== "high") {
    for (const { re, reason } of MEDIUM_PATTERNS) {
      if (re.test(text)) {
        level = "medium";
        reasons.push(reason);
      }
    }
  }

  // Any edit to published content is high-risk regardless of the verb, because
  // it mutates what learners are actively using.
  if (context?.programStatus === "published") {
    level = "high";
    reasons.push("Changes content that is already published");
  }

  const deduped = Array.from(new Set(reasons));
  return {
    level,
    requiresApproval: level !== "low",
    reasons: deduped,
  };
}
