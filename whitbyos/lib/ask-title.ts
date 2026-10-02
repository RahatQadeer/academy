import "server-only";

import { generateJson, isAiConfigured } from "@/whitbyos/lib/ai/provider";
import { askThreadLabel } from "@/whitbyos/lib/ask-format";

/**
 * A short topic for the rail / header — not the raw starter sentence.
 * "Create a work plan for the open client" → "Rohail Khan Work Plan".
 */
export async function suggestAskThreadTitle(input: {
  question: string;
  clientName?: string | null;
  workspaceId: string;
  /** Extra turns when refining after the first reply. */
  extras?: string[];
}): Promise<string> {
  const fallback = fallbackTitle(input.question, input.clientName);

  if (!isAiConfigured()) return fallback;

  const bits = [
    input.clientName ? `Open client: ${input.clientName}` : "No client is open.",
    `First message: ${input.question}`,
    ...(input.extras ?? []).map((row, i) => `Note ${i + 1}: ${row}`),
  ].join("\n");

  const result = await generateJson<{ title: string }>({
    system: [
      "You name Ask Whitby chats for a professional services workspace.",
      "Return a short topic title: 2 to 6 words, Title Case.",
      "Name the work, not the instruction. Prefer the client's name when relevant.",
      "Examples: Rohail Visa Work Plan, Overdue Tasks, New Client Setup, Message Sara.",
      "Never copy the whole user sentence. Never use em dashes. Never invent a client name.",
    ].join(" "),
    prompt: bits,
    schema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
    workspaceId: input.workspaceId,
    feature: "ask",
  });

  if (!result.ok) return fallback;
  const clean = askThreadLabel(result.data.title.replace(/["']/g, "").trim());
  if (!clean || clean === "New chat" || clean.length > 48) return fallback;
  return clean;
}

/** True when the stored title is still a raw command, worth replacing once. */
export function isRawAskTitle(title: string) {
  const v = title.replace(/\s+/g, " ").trim().toLowerCase();
  if (!v) return true;
  if (/^(create|make|draft|start|build|new|what is|what's|summarise|summarize|tell me|give me)\b/.test(v)) {
    return true;
  }
  if (v.includes("open client") || v.includes("for the open")) return true;
  if (v.length > 42) return true;
  return false;
}

function fallbackTitle(question: string, clientName?: string | null) {
  const q = question.replace(/\s+/g, " ").trim().toLowerCase();
  const who = clientName?.trim();

  if (/\bwork\s*plan\b/.test(q) || /\bworkplan\b/.test(q)) {
    return askThreadLabel(who ? `${who} Work Plan` : "New Work Plan");
  }
  if (/\btask\b/.test(q)) {
    return askThreadLabel(who ? `${who} Task` : "New Task");
  }
  if (/\bclient\b/.test(q) && /\b(create|add|new)\b/.test(q)) {
    return "New Client";
  }
  if (/\brequest\b/.test(q) && /\b(create|open|new)\b/.test(q)) {
    return askThreadLabel(who ? `${who} Request` : "New Request");
  }
  if (/\b(message|msg|email)\b/.test(q)) {
    return "New Message";
  }
  if (/\boverdue\b/.test(q)) return "Overdue Work";
  if (/\brequest/.test(q) && /\b(open|summar)/.test(q)) return "Open Requests";

  const labeled = askThreadLabel(question);
  return labeled.length > 42 ? `${labeled.slice(0, 41).trim()}…` : labeled;
}
