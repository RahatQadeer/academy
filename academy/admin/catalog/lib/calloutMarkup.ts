export type LessonCalloutVariant = "important" | "warning" | "tip" | "note" | "info";

const CALLOUT_ALIASES: Record<string, LessonCalloutVariant> = {
  important: "important",
  warning: "warning",
  tip: "tip",
  note: "note",
  info: "info",
  information: "info",
  "key-concept": "important",
  keyconcept: "important",
  key: "important",
};

const CALLOUT_LABEL: Record<LessonCalloutVariant, string> = {
  important: "Important",
  warning: "Warning",
  tip: "Tip",
  note: "Note",
  info: "Info",
};

function mapCalloutLabel(raw: string): LessonCalloutVariant | null {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
  return CALLOUT_ALIASES[key] ?? null;
}

/** True when `[Label]` / `[Label: …]` is a callout marker, not a markdown link. */
export function looksLikeCalloutLabel(raw: string): boolean {
  const name = raw.split(":")[0]?.trim() ?? "";
  return mapCalloutLabel(name) !== null;
}

/** Strip a single pair of wrapping [brackets] around a sentence. */
export function stripWrappingBrackets(text: string): string {
  let value = text.trim();
  for (let i = 0; i < 3; i++) {
    if (!value.startsWith("[") || !value.endsWith("]")) break;
    if (value.includes("\n")) break;
    const inner = value.slice(1, -1).trim();
    if (!inner || inner.includes("[") || inner.includes("]")) break;
    if (looksLikeCalloutLabel(inner) && !inner.includes(":")) break;
    value = inner;
  }
  return value;
}

function peelCalloutWrapper(text: string): {
  variant: LessonCalloutVariant;
  title: string;
  body: string;
} | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[")) return null;
  const match = trimmed.match(/^\[([^\]]+)\]\s*([\s\S]*)$/);
  if (!match) return null;

  const inside = match[1].trim();
  const rest = match[2].trim();
  const colon = inside.indexOf(":");
  const name = (colon >= 0 ? inside.slice(0, colon) : inside).trim();
  const afterColon = colon >= 0 ? inside.slice(colon + 1).trim() : "";
  const variant = mapCalloutLabel(name);

  if (!variant) {
    if (!rest) return { variant: "info", title: "", body: inside };
    return null;
  }

  if (!rest) {
    if (!afterColon) return { variant, title: "", body: "" };
    const afterIsTitle = afterColon.length <= 32 && !/[.!?]$/.test(afterColon);
    if (afterIsTitle) return { variant, title: afterColon, body: "" };
    return { variant, title: "", body: afterColon };
  }

  const title = afterColon && afterColon.length <= 32 && !/[.!?]$/.test(afterColon) ? afterColon : "";
  return { variant, title, body: rest };
}

/** Peel nested `[info] [Important: body.]` into a plain sentence + variant. */
export function unwrapCalloutSource(source: string): {
  variant: LessonCalloutVariant;
  title: string;
  text: string;
} {
  let remaining = source.trim();
  let variant: LessonCalloutVariant = "info";
  let title = "";

  for (let i = 0; i < 5; i++) {
    const peeled = peelCalloutWrapper(remaining);
    if (!peeled) break;
    variant = peeled.variant;
    if (peeled.title) title = peeled.title;
    remaining = peeled.body;
    if (!remaining.startsWith("[")) break;
  }

  const paragraphs = remaining.split(/\n+/);
  if (paragraphs[0]) paragraphs[0] = stripWrappingBrackets(paragraphs[0]);
  remaining = paragraphs.join("\n").trim();
  remaining = stripWrappingBrackets(remaining);

  return {
    variant,
    title: title || CALLOUT_LABEL[variant],
    text: remaining,
  };
}

function isGenericCalloutTitle(title: string, variant: string) {
  const t = title.trim().toLowerCase();
  const v = variant.trim().toLowerCase();
  return (
    !t ||
    t === v ||
    t === "note" ||
    t === "info" ||
    t === "information" ||
    t === "important" ||
    t === "tip" ||
    t === "warning"
  );
}

/** Canonical one-line callout: `[Important] plain sentence` — never nested brackets. */
export function formatCalloutMarkdown(variant: string, text: string, title?: string): string {
  const inner = unwrapCalloutSource(text);
  const outerLabel = mapCalloutLabel(variant) ?? "info";
  const resolved = inner.variant !== "info" ? inner.variant : outerLabel;
  const body = inner.text || stripWrappingBrackets(text);
  if (!body) return "";
  const extraTitle =
    title && !isGenericCalloutTitle(title, resolved) ? unwrapCalloutSource(title).text : "";
  const sentence = extraTitle && extraTitle !== body ? `${extraTitle}. ${body}` : body;
  return `[${CALLOUT_LABEL[resolved]}] ${sentence}`.trim();
}

/** Rewrite stored callout lines so learners never see `[Important: …]` wrappers. */
export function normalizeCalloutMarkdown(body: string): string {
  if (!body.includes("[")) return body;

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const opener = trimmed.match(/^\[([^\]]+)\]/);
    if (!opener || !looksLikeCalloutLabel(opener[1])) {
      out.push(line);
      continue;
    }

    let chunk = trimmed;
    if (/^\[[^\]]+\]\s*$/.test(trimmed) && i + 1 < lines.length && lines[i + 1].trim()) {
      chunk = `${trimmed} ${lines[i + 1].trim()}`;
      i += 1;
    }

    const formatted = formatCalloutMarkdown("info", chunk);
    out.push(formatted || line);
  }

  return out.join("\n");
}
