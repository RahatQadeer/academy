import "server-only";

import { setDefaultResultOrder } from "node:dns";
import { formatCalloutMarkdown, stringifyContentValue } from "@/academy/admin/catalog/lib/lessonContentText";
import { splitDefinitionTermAndMeaning } from "@/academy/lib/lessonContentDesign";
import { EXERCISE_BLANK, normalizeExerciseBlank } from "@/academy/lib/lessonExercise";

try {
  setDefaultResultOrder("ipv4first");
} catch {
  /* Node without this DNS API */
}

const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
const NETWORK_ATTEMPTS = 3;

/** Task classes for model routing — prefer chat unless deep multi-step reasoning is required. */
export type DeepSeekTask = "chat" | "route" | "write" | "reason";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekCallOptions = {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override model; otherwise chosen from task + env. */
  model?: string;
  /** Selects deepseek-chat vs deepseek-reasoner when model is unset. */
  task?: DeepSeekTask;
  /** Log label for latency metrics. */
  label?: string;
  /**
   * When true (default for chat/route), stream the DeepSeek response and
   * accumulate server-side so TTFT is measurable and the connection stays warm.
   * json_object responses are still parsed after the full stream completes.
   */
  stream?: boolean;
  /** Optional per-token callback (streaming text completions). */
  onToken?: (token: string) => void;
};

function causeCode(error: unknown): string {
  if (!(error instanceof Error) || !error.cause || typeof error.cause !== "object") return "";
  const cause = error.cause as { code?: string; name?: string };
  return String(cause.code ?? cause.name ?? "");
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error) || error.name === "AbortError") return false;
  const code = causeCode(error);
  return (
    error.message === "fetch failed" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_SOCKET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  );
}

export function describeDeepSeekError(error: unknown): Error {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error("DeepSeek request failed: timed out");
  }
  if (isRetryableNetworkError(error)) {
    return new Error("Could not reach DeepSeek. The connection timed out — try generating again.");
  }
  if (error instanceof Error) return error;
  return new Error("DeepSeek request failed unexpectedly.");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function extractJson(content: string): string {
  const raw = content.trim();
  if (raw.startsWith("{") && raw.endsWith("}")) return raw;
  if (raw.startsWith("[") && raw.endsWith("]")) return raw;
  const start = Math.min(
    raw.indexOf("{") === -1 ? Infinity : raw.indexOf("{"),
    raw.indexOf("[") === -1 ? Infinity : raw.indexOf("["),
  );
  const endObj = raw.lastIndexOf("}");
  const endArr = raw.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (start === Infinity || end === -1) return raw;
  return raw.slice(start, end + 1);
}

/** Best-effort close for truncated JSON objects/arrays from max_tokens cuts. */
function repairTruncatedJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let repaired = trimmed;
  if (inString) repaired += "\"";

  // Drop a trailing incomplete key/value fragment after the last safe delimiter.
  repaired = repaired.replace(/,\s*("[^"]*"\s*:)?\s*$/, "");
  repaired = repaired.replace(/:\s*$/, ": null");

  while (stack.length) repaired += stack.pop();
  return repaired;
}

function parseJsonLenient(content: string): unknown | null {
  const extracted = extractJson(content);
  try {
    return JSON.parse(extracted);
  } catch {
    const repaired = repairTruncatedJson(extracted);
    if (!repaired) return null;
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * deepseek-chat for normal conversation / routing / writing.
 * deepseek-reasoner only when task=reason AND COURSEGEN_MODEL_REASONING is set
 * (full-program rewrites). Default stays deepseek-chat — reasoner is slower and
 * not needed for Whitby chat. COURSEGEN_MODEL_WRITING overrides everything.
 */
export function resolveDeepSeekModel(task: DeepSeekTask = "write"): string {
  const writingOverride =
    (process.env.COURSEGEN_MODEL_WRITING ?? "").split(",")[0]?.trim() || "";
  if (writingOverride) return writingOverride;
  if (task === "reason") {
    const reasoning =
      (process.env.COURSEGEN_MODEL_REASONING ?? "").split(",")[0]?.trim() || "";
    // Opt-in only — default chat keeps Whitby snappy.
    return reasoning || DEFAULT_DEEPSEEK_MODEL;
  }
  return DEFAULT_DEEPSEEK_MODEL;
}

function deepseekModel(task: DeepSeekTask = "write") {
  return resolveDeepSeekModel(task);
}

function logDeepSeekTiming(meta: {
  label: string;
  model: string;
  stream: boolean;
  totalMs: number;
  ttftMs: number | null;
  contentChars: number;
  maxTokens: number;
  temperature: number;
}) {
  const ttft = meta.ttftMs == null ? "n/a" : `${meta.ttftMs}ms`;
  console.info(
    `[deepseek] ${meta.label} model=${meta.model} stream=${meta.stream} total=${meta.totalMs}ms ttft=${ttft} chars=${meta.contentChars} max_tokens=${meta.maxTokens} temp=${meta.temperature}`,
  );
}

async function readSseContent(
  response: Response,
  onToken?: (token: string) => void,
): Promise<{ content: string; ttftMs: number | null }> {
  if (!response.body) {
    throw new Error("DeepSeek request failed: empty stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let ttftMs: number | null = null;
  const started = Date.now();

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const payload = JSON.parse(data) as {
        choices?: { delta?: { content?: string }; message?: { content?: string } }[];
      };
      const token =
        payload.choices?.[0]?.delta?.content ?? payload.choices?.[0]?.message?.content ?? "";
      if (!token) return;
      if (ttftMs == null) ttftMs = Date.now() - started;
      content += token;
      onToken?.(token);
    } catch {
      /* ignore malformed SSE frames */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    if (done) buffer += decoder.decode();

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      consumeLine(line);
    }

    if (done) {
      if (buffer.trim()) consumeLine(buffer);
      break;
    }
  }

  return { content, ttftMs };
}

async function deepseekCompletion(
  messages: DeepSeekMessage[],
  options: DeepSeekCallOptions & { json?: boolean } = {},
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const task = options.task ?? (options.json ? "write" : "chat");
  const model = options.model ?? deepseekModel(task);
  // Reasoner ignores custom temperature; keep chat/route/write in the 0.3–0.5 band by default.
  const temperature = options.temperature ?? (task === "chat" || task === "route" ? 0.4 : 0.5);
  const maxTokens = options.maxTokens ?? (task === "chat" || task === "route" ? 400 : 8000);
  const timeoutMs = options.timeoutMs ?? 55_000;
  const label = options.label ?? task;
  // Prefer streaming for chat/route so TTFT is visible; JSON callers can opt in.
  const useStream = options.stream ?? (task === "chat" || task === "route");

  const requestBody = JSON.stringify({
    model,
    temperature: model.includes("reasoner") ? undefined : temperature,
    max_tokens: maxTokens,
    stream: useStream,
    ...(options.json ? { response_format: { type: "json_object" } } : {}),
    messages,
  });

  const started = Date.now();
  let response: Response | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= NETWORK_ATTEMPTS; attempt++) {
    if (options.signal?.aborted) {
      throw new Error("Generation cancelled");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort);

    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
        cache: "no-store",
        signal: controller.signal,
      });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) {
        throw new Error("Generation cancelled");
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("DeepSeek request failed: timed out");
      }
      if (!isRetryableNetworkError(error) || attempt === NETWORK_ATTEMPTS) {
        throw describeDeepSeekError(error);
      }
      await sleep(attempt * 800);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }

  if (!response) {
    throw describeDeepSeekError(lastError);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const suffix = detail ? ` — ${detail.slice(0, 160)}` : "";
    throw new Error(`DeepSeek request failed: HTTP ${response.status}${suffix}`);
  }

  let content = "";
  let ttftMs: number | null = null;

  if (useStream) {
    const streamed = await readSseContent(response, options.onToken);
    content = streamed.content;
    ttftMs = streamed.ttftMs;
  } else {
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    content = payload.choices?.[0]?.message?.content ?? "";
    ttftMs = Date.now() - started;
  }

  logDeepSeekTiming({
    label,
    model,
    stream: useStream,
    totalMs: Date.now() - started,
    ttftMs,
    contentChars: content.length,
    maxTokens,
    temperature,
  });

  if (!content.trim()) {
    throw new Error("DeepSeek request failed: empty response");
  }
  return content;
}

export async function generateJson<T>(
  system: string,
  prompt: string,
  options: DeepSeekCallOptions = {},
): Promise<T | null> {
  const content = await deepseekCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    {
      ...options,
      json: true,
      task: options.task ?? "write",
      // JSON mode + stream is fine; still accumulate before parse.
      stream: options.stream ?? false,
      label: options.label ?? "json",
    },
  );

  return parseJsonLenient(content) as T | null;
}

/** Free-form text completion — preferred for Whitby chat replies (faster than JSON mode). */
export async function generateText(
  system: string,
  prompt: string,
  options: DeepSeekCallOptions = {},
): Promise<string> {
  return deepseekCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    {
      ...options,
      json: false,
      task: options.task ?? "chat",
      stream: options.stream ?? true,
      temperature: options.temperature ?? 0.4,
      maxTokens: options.maxTokens ?? 350,
      label: options.label ?? "chat",
    },
  );
}

function formatListItems(items: unknown[] | undefined, ordered: boolean) {
  return (items ?? [])
    .map((item) => stringifyContentValue(item))
    .filter(Boolean)
    .map((item, index) => (ordered ? `${index + 1}. ${item}` : `• ${item}`))
    .join("\n");
}

export function blocksToBody(
  blocks: {
    type: string;
    text?: unknown;
    level?: number;
    ordered?: boolean;
    items?: unknown[];
    variant?: string;
    title?: unknown;
    scenario?: unknown;
    walkthrough?: unknown[];
    outcome?: unknown;
    steps?: unknown[];
    headers?: unknown[];
    rows?: unknown[][];
    language?: string;
    code?: unknown;
    caption?: unknown;
    prompt?: unknown;
    options?: unknown[];
    answer?: unknown;
    term?: unknown;
    meaning?: unknown;
  }[],
): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "paragraph":
          return stringifyContentValue(block.text);
        case "heading": {
          const text = stringifyContentValue(block.text);
          return text ? `${"#".repeat(block.level ?? 2)} ${text}` : "";
        }
        case "list":
        case "pairs":
        case "matching":
          return formatListItems(block.items, Boolean(block.ordered));
        case "callout": {
          const title = stringifyContentValue(block.title);
          const text = stringifyContentValue(block.text);
          return formatCalloutMarkdown(String(block.variant ?? "info"), text, title);
        }
        case "example": {
          const title = stringifyContentValue(block.title) || "Applied scenario";
          const situation = stringifyContentValue(block.scenario) || stringifyContentValue(block.text);
          const walkthrough = (block.walkthrough ?? []).map(stringifyContentValue).filter(Boolean);
          const outcome = stringifyContentValue(block.outcome);
          const decision =
            walkthrough.find((line) => /^decision:/i.test(line)) ||
            walkthrough[walkthrough.length - 1] ||
            "";
          const decisionText = decision.replace(/^decision:\s*/i, "");
          const bodyLines = [
            situation,
            ...walkthrough.filter((line) => !/^decision:/i.test(line) && line !== decision),
            decisionText ? `Decision: ${decisionText}` : "",
            outcome ? `Recommended answer: ${outcome}` : "",
          ].filter(Boolean);
          if (!bodyLines.length) return "";
          return [`Scenario — ${title}`, ...bodyLines].join("\n");
        }
        case "steps":
          return formatListItems(block.steps, true);
        case "table": {
          const headers = (block.headers ?? []).map(stringifyContentValue).filter(Boolean);
          const rows = (block.rows ?? [])
            .map((row) => (Array.isArray(row) ? row : [row]).map(stringifyContentValue))
            .filter((row) => row.some(Boolean));
          if (!headers.length && !rows.length) return "";
          return [headers.join(" | "), ...rows.map((row) => row.join(" | "))].filter(Boolean).join("\n");
        }
        case "definition": {
          const rawTerm =
            stringifyContentValue((block as { term?: unknown }).term) ||
            stringifyContentValue(block.title);
          const rawMeaning =
            stringifyContentValue((block as { meaning?: unknown }).meaning) ||
            stringifyContentValue(block.text);
          const repaired =
            splitDefinitionTermAndMeaning(
              [rawTerm, rawMeaning].filter(Boolean).join("\n"),
            ) ||
            (rawTerm ? splitDefinitionTermAndMeaning(rawTerm) : null) ||
            (rawMeaning ? splitDefinitionTermAndMeaning(rawMeaning) : null);
          const term = repaired?.term || rawTerm || "Term";
          const meaning = repaired?.meaning || rawMeaning;
          if (!meaning || meaning === term) return "";
          return [`Definition — ${term}`, meaning].join("\n");
        }
        case "code": {
          const code = typeof block.code === "string" ? block.code : stringifyContentValue(block.code);
          if (!code.trim()) return "";
          return `\`\`\`${block.language ?? ""}\n${code}\n\`\`\`${block.caption ? `\n${stringifyContentValue(block.caption)}` : ""}`;
        }
        case "exercise": {
          const prompt = stringifyContentValue(block.prompt) || stringifyContentValue(block.text);
          const rawCode =
            typeof block.code === "string" ? block.code.trim() : stringifyContentValue(block.code);
          const options = (block.options ?? [])
            .map((item) => stringifyContentValue(item))
            .filter(Boolean);
          const answer = stringifyContentValue(block.answer);
          const explanation =
            stringifyContentValue((block as { explanation?: unknown }).explanation) ||
            stringifyContentValue((block as { rationale?: unknown }).rationale);
          if (!prompt || !rawCode || options.length < 2 || !answer) return "";
          const code = /\[\[\s*\]\]|\{\{\s*blank\s*\}\}|_{3,}/i.test(rawCode)
            ? normalizeExerciseBlank(rawCode)
            : `${rawCode}\n${EXERCISE_BLANK}`;
          return [
            "```exercise",
            `PROMPT: ${prompt}`,
            "CODE:",
            code,
            `OPTIONS: ${options.join(" | ")}`,
            `ANSWER: ${answer}`,
            explanation ? `EXPLANATION: ${explanation}` : null,
            "```",
          ]
            .filter(Boolean)
            .join("\n");
        }
        default:
          return (
            formatListItems(block.items, Boolean(block.ordered)) ||
            formatListItems(block.steps, true) ||
            stringifyContentValue(block.text)
          );
      }
    })
    .filter(Boolean)
    .join("\n\n");
}
