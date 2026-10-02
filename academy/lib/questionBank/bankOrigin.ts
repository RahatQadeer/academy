/**
 * Quiz `options` jsonb may be a plain string[] or
 * `{ choices: string[]; fromBank?: boolean }` so authors can see which
 * questions were pulled from the question bank — without exposing that
 * flag to learners.
 */

export type StoredQuizOptions =
  | string[]
  | {
      choices: string[];
      fromBank?: boolean;
    };

export function parseStoredQuizOptions(raw: unknown): {
  choices: string[];
  fromBank: boolean;
} {
  if (Array.isArray(raw)) {
    return {
      choices: raw.map(choiceLabel).filter(Boolean),
      fromBank: false,
    };
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.choices)) {
      return {
        choices: record.choices.map(choiceLabel).filter(Boolean),
        fromBank: Boolean(record.fromBank),
      };
    }
  }
  return { choices: [], fromBank: false };
}

function choiceLabel(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (typeof item === "number" || typeof item === "boolean") return String(item);
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const label = record.label ?? record.text ?? record.value;
    if (label != null) return String(label).trim();
  }
  return "";
}

export function serializeQuizOptions(choices: string[], fromBank?: boolean): StoredQuizOptions {
  const clean = choices.map((item) => item.trim()).filter(Boolean);
  if (fromBank) return { choices: clean, fromBank: true };
  return clean;
}

/** Invisible markers for assignment brief prompts added from the bank. */
export const BANK_BRIEF_OPEN = "<!--pa-bank-->";
export const BANK_BRIEF_CLOSE = "<!--/pa-bank-->";

export function wrapBankBriefPrompt(prompt: string) {
  const text = prompt.trim();
  if (!text) return "";
  if (text.includes(BANK_BRIEF_OPEN)) return text;
  return `${BANK_BRIEF_OPEN}\n${text}\n${BANK_BRIEF_CLOSE}`;
}

export function stripBankBriefMarkers(text: string) {
  return text
    .replaceAll(BANK_BRIEF_OPEN, "")
    .replaceAll(BANK_BRIEF_CLOSE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type BankBriefBlock =
  | { kind: "text"; text: string }
  | { kind: "bank"; text: string };

export function splitBankBriefBlocks(brief: string): BankBriefBlock[] {
  const raw = brief ?? "";
  if (!raw.includes(BANK_BRIEF_OPEN)) {
    const text = raw.trim();
    return text ? [{ kind: "text", text }] : [];
  }

  const blocks: BankBriefBlock[] = [];
  const pattern = /<!--pa-bank-->\s*([\s\S]*?)\s*<!--\/pa-bank-->/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const before = raw.slice(last, match.index).trim();
    if (before) blocks.push({ kind: "text", text: before });
    const bankText = match[1]?.trim() ?? "";
    if (bankText) blocks.push({ kind: "bank", text: bankText });
    last = match.index + match[0].length;
  }
  const after = raw.slice(last).trim();
  if (after) blocks.push({ kind: "text", text: after });
  return blocks;
}

export function briefHasBankPrompt(brief: string) {
  return (brief ?? "").includes(BANK_BRIEF_OPEN);
}
