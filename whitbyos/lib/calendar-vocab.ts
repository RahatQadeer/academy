/** Calendar vocabulary, kept clear of the server module so the dialogs can import it. */

export const EVENT_KIND = [
  { value: "appointment", label: "Appointment" },
  { value: "meeting", label: "Meeting" },
  { value: "key_date", label: "Key Date" },
] as const;

export function eventKindLabel(value: string) {
  return EVENT_KIND.find((k) => k.value === value)?.label ?? "Appointment";
}

/**
 * A Key Date reads as the one that matters most — §6.7.7 defines it as a date
 * that materially drives a Workstream, which is a different weight from an
 * appointment someone happens to have.
 */
export function eventKindTone(value: string) {
  switch (value) {
    case "meeting":
      return "warning" as const;
    case "key_date":
      return "danger" as const;
    default:
      return "info" as const;
  }
}

/** The calendars §11.1 names, and the dot colour each connected one shows. */
export const CALENDARS = [
  { value: "google_calendar", label: "Google Calendar", dot: "#4285f4" },
  { value: "outlook_calendar", label: "Outlook Calendar", dot: "#0078d4" },
] as const;

export function calendarLabel(value: string | null) {
  return CALENDARS.find((c) => c.value === value)?.label ?? null;
}

export function calendarDot(value: string | null) {
  return CALENDARS.find((c) => c.value === value)?.dot ?? "var(--text-disabled)";
}

/**
 * The block an event is drawn as inside a Day column — a tinted card in its
 * own kind's colour, the same three the pill uses.
 */
export function eventCard(kind: string) {
  switch (kind) {
    case "meeting":
      return { background: "var(--warning-bg)", borderColor: "var(--warning-border)" };
    case "key_date":
      return { background: "var(--danger-bg)", borderColor: "var(--danger-border)" };
    default:
      return { background: "var(--accent-tint-mid)", borderColor: "var(--info-bg)" };
  }
}

/** The one-line chip a Month cell has room for. */
export function eventChip(kind: string) {
  switch (kind) {
    case "meeting":
      return { background: "var(--warning-bg)", color: "var(--warning-fg)" };
    case "key_date":
      return { background: "var(--danger-bg)", color: "var(--danger-fg)" };
    default:
      return { background: "var(--info-bg)", color: "var(--info-fg)" };
  }
}

/**
 * The mark down the left of every row, which answers "where did this come
 * from" before the title is read. A Key Date is drawn as a diamond rather than
 * a dot: §6.7.7 makes it a date that drives the work rather than one more
 * thing in the day, and at 11px the shape carries that further than the colour.
 */
export function sourceGlyph(kind: string) {
  return kind === "key_date" ? "◆" : "●";
}

export function sourceColor(kind: string, externalCalendar: string | null) {
  if (kind === "key_date") return "var(--danger-fg)";
  return calendarDot(externalCalendar);
}

export function sourceTitle(externalCalendar: string | null) {
  return calendarLabel(externalCalendar) ?? "Held in Whitby";
}
