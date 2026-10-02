import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { cn } from "@/base/lib/cn";
import { timeRange } from "@/client-portal/lib/format";
import type { CalendarItem } from "@/client-portal/types";
import { KIND_LABEL, kindTone, markColor, markGlyph, sourceLabel } from "./vocab";

/** The mark that says where an event came from, or that it is a Key Date. */
export function SourceMark({ item }: { item: CalendarItem }) {
  return (
    <span
      className="w-[15px] shrink-0 text-[11px]"
      style={{ color: markColor(item) }}
      title={sourceLabel(item)}
      aria-hidden
    >
      {markGlyph(item)}
    </span>
  );
}

/** The Request an event belongs to, in the outlined chip a row ends with. */
export function RequestChip({ title, onCard }: { title: string; onCard?: boolean }) {
  return (
    <span
      title={`Request: ${title}`}
      className="hidden shrink-0 truncate rounded border border-line px-2 py-0.5 text-[11.5px] sm:inline"
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
 * What a row says it is. The client's own event has no kind the team gave it,
 * so it says whose it is instead — or that they declined it.
 */
export function KindPill({ item }: { item: CalendarItem }) {
  if (item.personal) {
    return (
      <Pill tone={item.personal.declined ? "warning" : "neutral"}>
        {item.personal.declined ? "Declined" : "Only you"}
      </Pill>
    );
  }
  return <Pill tone={kindTone(item.kind)}>{KIND_LABEL[item.kind]}</Pill>;
}

export function timeLabel(item: CalendarItem, timeZone: string) {
  if (item.allDay) return "All day";
  return new Date(item.startAt).toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One line of the Week agenda, as Whitby draws it. The whole line opens the event. */
export function EventRow({
  item,
  timeZone,
  href,
}: {
  item: CalendarItem;
  timeZone: string;
  href: string;
}) {
  const declined = item.personal?.declined === true;

  return (
    <Link
      href={href}
      scroll={false}
      className="flex items-center gap-3.5 border-b border-line px-4 py-3 no-underline hover:bg-surface-soft"
      style={{ color: "var(--ink)" }}
    >
      <span
        className="w-[76px] shrink-0 text-[12.5px]"
        style={{ color: "var(--text-tertiary)" }}
        title={item.allDay ? undefined : timeRange(item.startAt, item.endAt, timeZone)}
      >
        {timeLabel(item, timeZone)}
      </span>

      <SourceMark item={item} />

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13.5px]",
          (item.kind === "key_date" || item.kind === "deadline") && "font-medium",
          declined && "line-through",
        )}
        style={declined ? { color: "var(--text-tertiary)" } : undefined}
      >
        {item.title}
      </span>

      <KindPill item={item} />

      {item.requestTitle ? <RequestChip title={item.requestTitle} /> : null}
    </Link>
  );
}
