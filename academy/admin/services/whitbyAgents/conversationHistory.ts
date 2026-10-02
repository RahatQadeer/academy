/**
 * Sliding-window chat context for Whitby.
 * Keeps the last N turns raw; compresses older turns into a short summary
 * so the model stays focused on recent intent without context bloat.
 */

export type ChatTurn = { role: "user" | "whitby"; content: string };

const DEFAULT_WINDOW = 12;
const MAX_TURN_CHARS = 360;
const MAX_SUMMARY_CHARS = 480;

function clip(text: string, max: number) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Heuristic summary — no extra API call (keeps latency down). */
export function summarizeOlderTurns(older: ChatTurn[]): string {
  if (!older.length) return "";

  const beats: string[] = [];
  for (const turn of older) {
    const text = clip(turn.content, 120);
    if (!text) continue;
    if (turn.role === "user") {
      beats.push(`Instructor asked: ${text}`);
    } else {
      const action =
        /done —|applied|added|removed|updated|renamed|drafted/i.test(text)
          ? `Whitby changed: ${text}`
          : `Whitby said: ${text}`;
      beats.push(action);
    }
    if (beats.join(" ").length > MAX_SUMMARY_CHARS) break;
  }

  return clip(beats.join(" · "), MAX_SUMMARY_CHARS);
}

export function buildConversationContext(
  turns: ChatTurn[] | undefined,
  options?: { windowSize?: number },
): { summary: string; recent: ChatTurn[]; totalTurns: number } {
  const all = (turns ?? [])
    .map((turn) => ({
      role: turn.role,
      content: clip(turn.content, MAX_TURN_CHARS),
    }))
    .filter((turn) => turn.content.length > 0);

  const windowSize = options?.windowSize ?? DEFAULT_WINDOW;
  if (all.length <= windowSize) {
    return { summary: "", recent: all, totalTurns: all.length };
  }

  const older = all.slice(0, -windowSize);
  const recent = all.slice(-windowSize);
  return {
    summary: summarizeOlderTurns(older),
    recent,
    totalTurns: all.length,
  };
}

/** Prompt block ready to paste into Whitby agent prompts. */
export function conversationPromptBlock(
  turns: ChatTurn[] | undefined,
  options?: { windowSize?: number },
): string {
  const { summary, recent, totalTurns } = buildConversationContext(turns, options);
  if (!recent.length && !summary) return "";

  const lines: string[] = [];
  if (summary) {
    lines.push(`Earlier conversation (${Math.max(0, totalTurns - recent.length)} older turns, summarized):`);
    lines.push(summary);
    lines.push("");
  }
  if (recent.length) {
    lines.push("Recent conversation (read fully before answering):");
    for (const turn of recent) {
      lines.push(`${turn.role === "user" ? "Instructor" : "Whitby"}: ${turn.content}`);
    }
  }
  return lines.join("\n");
}
