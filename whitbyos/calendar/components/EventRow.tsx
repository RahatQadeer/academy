import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { cn } from "@/base/lib/cn";
import type { CalendarEvent } from "@/whitbyos/lib/calendar";
import { timeLabel } from "@/whitbyos/lib/calendar-format";
import {
  eventKindLabel,
  eventKindTone,
  sourceColor,
  sourceGlyph,
  sourceTitle,
} from "@/whitbyos/lib/calendar-vocab";

/** The mark that says where an event came from, or that it is a Key Date. */
export function SourceMark({ event }: { event: CalendarEvent }) {
  return (
    <span
      className="w-[15px] shrink-0 text-[11px]"
      style={{ color: sourceColor(event.kind, event.externalCalendar) }}
      title={
        event.kind === "key_date"
          ? "Key Date"
          : sourceTitle(event.externalCalendar)
      }
      aria-hidden
    >
      {sourceGlyph(event.kind)}
    </span>
  );
}

/** The Request an event belongs to, in the outlined chip every row ends with. */
export function RequestChip({
  title,
  kind = "Request",
  onCard,
}: {
  title: string;
  /**
   * Which of the two an event ends with. The reference draws only the
   * Request; the Client sits beside it in the same chip so a row says both
   * what the event is for and whose it is — and `title` names which is which,
   * since two outlined chips side by side otherwise read as one list.
   */
  kind?: "Request" | "Client";
  /** Inside a tinted Day-view card the chip keeps a white ground of its own. */
  onCard?: boolean;
}) {
  return (
    <span
      title={`${kind}: ${title}`}
      className="shrink-0 truncate rounded border border-line px-2 py-0.5 text-[11.5px]"
      style={{
        color: "var(--text-tertiary)",
        maxWidth: 200,
        background: onCard ? "var(--surface)" : undefined,
      }}
    >
      {title}
    </span>
  );
}

/**
 * One line of the Week agenda: when, where it came from, what it is, what it
 * is for. The whole line opens Screen 8.1.
 */
export function EventRow({
  event,
  timezone,
  href,
}: {
  event: CalendarEvent;
  timezone: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 border-b border-line px-4 py-3 no-underline hover:bg-surface-soft"
      style={{ color: "var(--ink)" }}
    >
      <span className="w-[76px] shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {timeLabel(event.start_at, event.allDay, timezone)}
      </span>

      <SourceMark event={event} />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13.5px]",
          event.kind === "key_date" && "font-medium",
        )}
      >
        {event.title}
      </span>

      <Pill tone={eventKindTone(event.kind)}>{eventKindLabel(event.kind)}</Pill>

      {event.requestTitle ? <RequestChip title={event.requestTitle} kind="Request" /> : null}

      {event.clientName ? <RequestChip title={event.clientName} kind="Client" /> : null}
    </Link>
  );
}
