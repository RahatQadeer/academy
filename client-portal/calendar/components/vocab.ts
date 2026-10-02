import { eventCard, eventChip, sourceColor, sourceGlyph } from "@/whitbyos/lib/calendar-vocab";
import type { CalendarItem, CalendarKind } from "@/client-portal/types";

/**
 * Whitby's calendar vocabulary, read for the portal's rows.
 *
 * Whitby knows three kinds; the portal still meets `travel` and `deadline` on
 * rows written before that settled. A deadline is drawn as the Key Date it has
 * since become, and travel as an appointment, so the three colours the two
 * sides use are the same three.
 */
function whitbyKind(kind: CalendarKind): string {
  if (kind === "deadline") return "key_date";
  if (kind === "travel") return "appointment";
  return kind;
}

export const KIND_LABEL: Record<CalendarKind, string> = {
  meeting: "Meeting",
  appointment: "Appointment",
  key_date: "Key date",
  travel: "Travel",
  deadline: "Deadline",
};

export function kindTone(kind: CalendarKind) {
  switch (whitbyKind(kind)) {
    case "meeting":
      return "warning" as const;
    case "key_date":
      return "danger" as const;
    default:
      return "info" as const;
  }
}

/** The client's own event carries no kind of the team's, so it is drawn plain. */
const PERSONAL_CHIP = { background: "var(--surface-soft)", color: "var(--text-secondary)" };
const PERSONAL_CARD = { background: "var(--surface-soft)", borderColor: "var(--border)" };

export function chipStyle(item: CalendarItem) {
  return item.personal ? PERSONAL_CHIP : eventChip(whitbyKind(item.kind));
}

export function cardStyle(item: CalendarItem) {
  return item.personal ? PERSONAL_CARD : eventCard(whitbyKind(item.kind));
}

export function markGlyph(item: CalendarItem) {
  return sourceGlyph(whitbyKind(item.kind));
}

export function markColor(item: CalendarItem) {
  return sourceColor(whitbyKind(item.kind), item.externalCalendar);
}

const SOURCE_LABEL: Record<string, string> = {
  google_calendar: "Google Calendar",
  outlook_calendar: "Outlook Calendar",
};

/**
 * Where an event came from, in the client's words. Whitby says "Held in
 * Whitby" here; the portal never names Whitby to a client (SRS 1.4).
 */
export function sourceLabel(item: CalendarItem): string {
  const calendar = item.externalCalendar ? SOURCE_LABEL[item.externalCalendar] : null;
  if (item.personal) return calendar ? `Your ${calendar}` : "Your calendar";
  if (whitbyKind(item.kind) === "key_date") return "Key date";
  return calendar ? `Shared by your team · ${calendar}` : "Shared by your team";
}
