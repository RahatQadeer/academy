import "server-only";

import { generateJson } from "../catalogPipeline/deepseek";
import { DESIGNER_SYSTEM } from "../catalogPipeline/prompts";
import type { PersistedProgramDraft } from "../catalogPersistence";
import type { WhitbyAgentResult, WhitbyPlan } from "./types";

function fallbackTitle(current: string, instruction: string): string {
  const quoted = instruction.match(/["“']([^"”']{4,80})["”']/);
  if (quoted?.[1]) return quoted[1].trim();

  const toMatch = instruction.match(
    /\b(?:to|into)\s+(?:a\s+|an\s+|the\s+)?(?:more\s+)?(?:best\s+|better\s+|catchier\s+|stronger\s+)?(?:heading|title|name)?\s*[:\-]?\s*(.+)$/i,
  );
  const candidate = toMatch?.[1]?.replace(/[.?!]+$/, "").trim();
  if (candidate && candidate.length >= 8 && !/^(more|best|better|heading|title|name)\b/i.test(candidate)) {
    return candidate.slice(0, 90);
  }

  // Soft polish when they asked for a better heading without supplying wording.
  const cleaned = current.replace(/\s+[—|:·\-].*$/, "").trim() || current.trim();
  if (/beginner/i.test(cleaned) && /java/i.test(cleaned)) {
    return "Java Foundations for Beginners";
  }
  return cleaned.length > 60 ? cleaned.slice(0, 57).trim() + "…" : cleaned;
}

export async function runOverviewAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
): Promise<WhitbyAgentResult> {
  const wantsName =
    (/\b(name|title|heading)\b/i.test(plan.notes) || /\brename\b/i.test(plan.notes)) &&
    !/\bcontent\b/i.test(plan.notes) &&
    !/\bdepth\b|\bshallow\b|\bthin\b/i.test(plan.notes);
  const wantsDescription = /\bdescription|overview|summary\b/i.test(plan.notes);

  const result = await generateJson<{
    name?: string;
    description?: string;
    category?: string;
    summary?: string;
  }>(
    `${DESIGNER_SYSTEM}

You are the Academy Overview Agent. Update only program title/description/category when asked.
When the instructor wants a better program/course name or heading, invent one clear, professional course title (max ~70 chars). Do not touch lessons or modules.
Return JSON.`,
    `Current name: ${draft.name}
Current description: ${draft.description}
Current category: ${draft.category}
Instructor: ${plan.notes}

Return JSON: { "name", "description", "category", "summary" }
Rules:
- If they asked to change the program/course name, title, or heading → set a stronger "name". Keep description unless they asked to change it.
- If they only asked for description/overview → keep name, update description.
- summary: one short sentence of what you changed (e.g. “Renamed the program to …”).
- Never mention lessons.`,
    { task: "write", temperature: 0.35, maxTokens: 500, stream: true, label: "whitby-overview" },
  );

  const name =
    (typeof result?.name === "string" && result.name.trim()) ||
    (wantsName ? fallbackTitle(draft.name, plan.notes) : undefined);
  const description =
    typeof result?.description === "string" && result.description.trim() && wantsDescription
      ? result.description.trim()
      : wantsDescription
        ? draft.description
        : undefined;

  const nextName = name && name !== draft.name ? name : undefined;
  const nextDescription =
    description && description !== draft.description ? description : undefined;
  const nextCategory =
    typeof result?.category === "string" &&
    result.category.trim() &&
    result.category.trim() !== draft.category
      ? result.category.trim()
      : undefined;

  if (!nextName && !nextDescription && !nextCategory) {
    return {
      agent: "overview",
      summary:
        "What should the course be called? Send a title like “rename the program to Java Foundations for Beginners”.",
      ops: [],
    };
  }

  const bits: string[] = [];
  if (nextName) bits.push(`Renamed the program to “${nextName}”`);
  if (nextDescription) bits.push("Updated the program description");
  if (nextCategory) bits.push(`Set category to “${nextCategory}”`);

  const undoHint = /\b(undo|remove changes|revert|not lesson)\b/i.test(plan.notes)
    ? " If earlier lesson edits were wrong, use Undo above the chat to roll them back."
    : "";

  return {
    agent: "overview",
    summary: `${result?.summary?.trim() || bits.join(". ") + "."}${undoHint}`.trim(),
    ops: [
      {
        kind: "set_overview",
        name: nextName,
        description: nextDescription,
        category: nextCategory,
      },
    ],
  };
}
