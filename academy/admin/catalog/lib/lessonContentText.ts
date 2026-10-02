/**
 * Turns AI/JSON lesson blocks into readable text and strips JS leftovers
 * like "undefined: undefined" that leak into matching lists.
 */

import { foldExerciseSpoilers } from "@/academy/lib/lessonExercise";
import { normalizeDefinitionMarkdown } from "@/academy/lib/lessonContentDesign";
import { normalizeCalloutMarkdown } from "./calloutMarkup";

export {
  formatCalloutMarkdown,
  looksLikeCalloutLabel,
  normalizeCalloutMarkdown,
  stripWrappingBrackets,
  unwrapCalloutSource,
} from "./calloutMarkup";
export type { LessonCalloutVariant } from "./calloutMarkup";

const LEFT_KEYS = [
  "title",
  "letter",
  "left",
  "term",
  "key",
  "prompt",
  "label",
  "sound",
  "item",
  "from",
  "name",
  "front",
  "question",
];

const RIGHT_KEYS = [
  "detail",
  "picture",
  "right",
  "value",
  "match",
  "meaning",
  "description",
  "word",
  "to",
  "image",
  "example",
  "back",
  "caption",
  "answer",
];

const JUNK_TOKEN = /^(undefined|null|nan|\[object object\])$/i;
const PLACEHOLDER_LINE =
  /^(?:\$\{[^}]+\}|undefined|null|nan|\[object object\])(?:\s*:\s*(?:\$\{[^}]+\}|undefined|null|nan|\[object object\]))+$/i;

function isJunkToken(text: string) {
  return JUNK_TOKEN.test(text.trim());
}

function dropJunkSide(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const unbolded = trimmed.replace(/^\*\*(.*)\*\*$/, "$1").trim();
  if (isJunkToken(unbolded) || /^\$\{[^}]+\}$/.test(unbolded)) return "";
  return trimmed;
}

function pickKeyedValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (!(key in record)) continue;
    const text = stringifyContentValue(record[key]);
    if (text) return text;
  }
  return "";
}

function formatRecord(record: Record<string, unknown>) {
  const left = pickKeyedValue(record, LEFT_KEYS);
  const right = pickKeyedValue(record, RIGHT_KEYS);
  if (left && right) return `${left}: ${right}`;
  if (left || right) return left || right;

  const values = Object.values(record).map(stringifyContentValue).filter(Boolean);
  if (values.length >= 2) return `${values[0]}: ${values.slice(1).join(" — ")}`;
  return values[0] ?? "";
}

/** Coerce a model block value (string, pair object, array) into lesson markdown. */
export function stringifyContentValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return cleanDisplayLine(value) ?? "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.map(stringifyContentValue).filter(Boolean).join(": ");
  }
  if (typeof value === "object") {
    return formatRecord(value as Record<string, unknown>);
  }
  return "";
}

export function isPlaceholderLine(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const unbolded = trimmed.replace(/^\*\*(.*)\*\*$/g, "$1").trim();
  if (/^\[object object\]$/i.test(unbolded)) return true;
  return PLACEHOLDER_LINE.test(unbolded);
}

/** Returns readable text, or null when the line is only a broken placeholder. */
export function cleanDisplayLine(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const formatted = stringifyContentValue(JSON.parse(trimmed));
      return formatted || null;
    } catch {
      // fall through and treat as ordinary text
    }
  }

  if (trimmed.includes(":")) {
    const index = trimmed.indexOf(":");
    const left = dropJunkSide(trimmed.slice(0, index));
    const right = dropJunkSide(trimmed.slice(index + 1));
    if (!left && !right) return null;
    if (left && right) return `${left}: ${right}`;
    return left || right;
  }

  const cleaned = dropJunkSide(trimmed);
  return cleaned || null;
}

/** Drop broken placeholder bullets/paragraphs from stored lesson markdown. */
export function sanitizeLessonMarkdown(body: string) {
  return normalizeDefinitionMarkdown(
    foldExerciseSpoilers(
      normalizeCalloutMarkdown(
        normalizeMarkdownTypography(
          normalizeCollapsedMarkdown(
            body
              .split("\n")
              .flatMap((line) => {
                const bullet = line.match(/^(\s*(?:[•\-]|[\d]+\.)\s+)(.*)$/);
                if (bullet) {
                  const cleaned = cleanDisplayLine(bullet[2]);
                  return cleaned ? [`${bullet[1]}${cleaned}`] : [];
                }
                if (isPlaceholderLine(line) && line.trim()) return [];
                return [line];
              })
              .join("\n")
              .replace(/\n{3,}/g, "\n\n")
              .trim(),
          ),
        ),
      ),
    ),
  );
}

/**
 * Fix common AI markdown mistakes so learners never see raw `#` hashes:
 * - `**## Title**` / `**# Title**` → `## Title`
 * - `##Title` (missing space) → `## Title`
 * - Trailing ATX hashes → stripped
 * - Mid-paragraph `## Heading` → split onto its own line
 * - `#word#` emphasis → **word**
 */
export function normalizeMarkdownTypography(body: string): string {
  if (!body) return body;

  let text = body.replace(/\r\n/g, "\n");

  // Protect fenced code / exercise blocks from heading rewrites.
  const fences: string[] = [];
  text = text.replace(/```[\s\S]*?```/g, (block) => {
    const token = `\u0000FENCE${fences.length}\u0000`;
    fences.push(block);
    return token;
  });

  text = text
    .split("\n")
    .map((line) => normalizeMarkdownLine(line))
    .join("\n");

  // Split a mid-line ATX heading onto its own line: "…end. ## Next Section"
  text = text.replace(
    /([.!?:])\s+(#{1,3})\s*([A-Z0-9][^\n]{2,100})$/gm,
    (_full, punct: string, hashes: string, title: string) =>
      `${punct}\n\n${hashes} ${title.replace(/\s+#+\s*$/, "").trim()}`,
  );
  text = text.replace(
    /([^\n#])\s+(#{1,3})\s+([A-Z0-9][^\n#]{2,80})$/gm,
    (_full, before: string, hashes: string, title: string) =>
      `${before}\n\n${hashes} ${title.replace(/\s+#+\s*$/, "").trim()}`,
  );

  // Restore fences
  text = text.replace(/\u0000FENCE(\d+)\u0000/g, (_m, index) => fences[Number(index)] ?? "");

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeMarkdownLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;

  // Bold-wrapped heading markers: **## Title** / **# Title**
  const boldHeading = trimmed.match(/^\*\*\s*(#{1,6})\s*(.+?)\s*\*\*$/);
  if (boldHeading) {
    const level = Math.min(3, boldHeading[1].length);
    const title = boldHeading[2].replace(/\s+#+\s*$/, "").trim();
    return title ? `${"#".repeat(level)} ${title}` : line;
  }

  // ATX heading missing space: ##Title / ###Title
  const jammed = trimmed.match(/^(#{1,6})([^\s#].*)$/);
  if (jammed && !trimmed.startsWith("```")) {
    const level = Math.min(3, jammed[1].length);
    const title = jammed[2].replace(/\s+#+\s*$/, "").trim();
    return title ? `${"#".repeat(level)} ${title}` : line;
  }

  // Normal ATX heading with trailing hashes: ## Title ##
  const atx = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  if (atx && !trimmed.includes("```")) {
    const level = Math.min(3, atx[1].length);
    const title = atx[2].replace(/\s+#+\s*$/, "").trim();
    if (title && !title.includes("#")) return `${"#".repeat(level)} ${title}`;
    if (title) return `${"#".repeat(level)} ${title.replace(/^#+\s*/, "").trim()}`;
  }

  // Pair-hash emphasis mistaken for bold: #term# (not a heading)
  if (!/^#{1,6}\s/.test(trimmed)) {
    return trimmed.replace(/(^|[\s(])#([^#\n]{1,60})#(?=$|[\s).,;:!?\]])/g, "$1**$2**");
  }

  return line;
}

/**
 * Whitby often emits markdown tables on one line:
 * `| A | B | | --- | --- | | row | data |`
 * Expand those into real rows so the lesson renderer can build a table.
 */
function isMarkdownSeparatorCell(value: string) {
  if (!value) return false;
  for (const ch of value) {
    if (ch !== "-" && ch !== ":" && ch !== " " && ch !== "\t") return false;
  }
  return true;
}

function isMarkdownSeparatorRow(compact: string) {
  // compact has whitespace already removed: "|---|---|---|" or "---|---|---"
  if (!compact.includes("-")) return false;
  for (const ch of compact) {
    if (ch !== "|" && ch !== "-" && ch !== ":") return false;
  }
  return compact.includes("|") || compact.length >= 3;
}

export function normalizeCollapsedMarkdown(body: string): string {
  let text = body.replace(/\r\n/g, "\n");
  if (!text.includes("|")) return text;

  // End of one row + start of next jammed together: "| | ---" or "| | Criteria"
  text = text.replace(/\|\s*\|(?=\s*(?:-{1,}:?\s*\|?|[^|\n]{1,120}\|))/g, "|\n|");

  text = text
    .split("\n")
    .map((line) => {
      if (!line.includes("|")) return line;
      const compact = line.replace(/\s/g, "");
      if (!isMarkdownSeparatorRow(compact)) return line;
      return line
        .split("|")
        .map((cell) => {
          const trimmed = cell.trim();
          if (!trimmed) return cell;
          if (isMarkdownSeparatorCell(trimmed)) return " --- ";
          return cell;
        })
        .join("|");
    })
    .join("\n");

  return text;
}
