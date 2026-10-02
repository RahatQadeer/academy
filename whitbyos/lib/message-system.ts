/**
 * Notices that a group changed — who was added or taken off.
 *
 * Stored as ordinary rows with `source = "system"` so they sit in the same
 * transcript as everything else, without a new table. The body is a small JSON
 * payload; the line somebody reads is built when the row is drawn, so "You"
 * is right for the person who did it and their name is right for everybody
 * else.
 */

export type SystemEvent = {
  event: "added" | "removed";
  names: string[];
};

export const SYSTEM_SOURCE = "system";

export function encodeSystemNotice(event: SystemEvent): string {
  return JSON.stringify({
    event: event.event,
    names: event.names.map((name) => name.trim()).filter(Boolean),
  });
}

export function parseSystemNotice(
  body: string,
  source: string | null | undefined,
): SystemEvent | null {
  if (source !== SYSTEM_SOURCE) return null;

  try {
    const parsed = JSON.parse(body) as { event?: string; names?: unknown };
    if (parsed.event !== "added" && parsed.event !== "removed") return null;
    if (!Array.isArray(parsed.names)) return null;
    const names = parsed.names.map(String).map((name) => name.trim()).filter(Boolean);
    if (names.length === 0) return null;
    return { event: parsed.event, names };
  } catch {
    return null;
  }
}

/** "Alice, Bob, and Carol" — the same shape WhatsApp uses for a few names. */
export function joinPeople(names: string[]): string {
  if (names.length === 0) return "someone";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * The line drawn in the transcript and on the conversation row.
 *
 * `mine` is whether the reader is the person who did it — then it says "You"
 * rather than their own name, the way a chat does.
 */
export function formatSystemNotice(
  event: SystemEvent,
  actorName: string,
  mine: boolean,
): string {
  const who = mine ? "You" : actorName.trim() || "Someone";
  const people = joinPeople(event.names);
  return event.event === "added" ? `${who} added ${people}` : `${who} removed ${people}`;
}
