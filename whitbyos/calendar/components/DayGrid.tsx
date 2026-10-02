import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { cn } from "@/base/lib/cn";
import type { CalendarEvent } from "@/whitbyos/lib/calendar";
import { hourLabel, hourOf } from "@/whitbyos/lib/calendar-format";
import { eventCard, eventKindLabel, eventKindTone } from "@/whitbyos/lib/calendar-vocab";
import { RequestChip, SourceMark } from "@/whitbyos/calendar/components/EventRow";

/** The hours the reference draws before anything is on them. */
const FIRST_HOUR = 7;
const LAST_HOUR = 17;

/**
 * Screen 8a — one day down an hour column.
 *
 * The grid runs 7am to 5pm as drawn, and stretches only as far as the day
 * actually goes: an event at 6am or 9pm pulls the column open to include it,
 * because an hour that is not drawn is an appointment that is not there.
 */
export function DayGrid({
  events,
  timezone,
  hrefFor,
}: {
  events: CalendarEvent[];
  timezone: string;
  hrefFor: (eventId: string) => string;
}) {
  const allDay = events.filter((event) => event.allDay);
  const timed = events.filter((event) => event.start_at && !event.allDay);

  const hoursUsed = timed.map((event) => hourOf(event.start_at as string, timezone));
  const first = Math.min(FIRST_HOUR, ...hoursUsed);
  const last = Math.max(LAST_HOUR, ...hoursUsed);

  const hours: number[] = [];
  for (let hour = first; hour <= last; hour += 1) hours.push(hour);

  return (
    <div className="flex-1 overflow-auto rounded-[8px] border border-line">
      <div className="flex flex-col">
        {allDay.length > 0 ? (
          <Slot label="All day" filled>
            {allDay.map((event) => (
              <Card key={event.id} event={event} href={hrefFor(event.id)} />
            ))}
          </Slot>
        ) : null}

        {hours.map((hour) => {
          const inThisHour = timed.filter(
            (event) => hourOf(event.start_at as string, timezone) === hour,
          );

          return (
            <Slot key={hour} label={hourLabel(hour)} filled={inThisHour.length > 0}>
              {inThisHour.map((event) => (
                <Card key={event.id} event={event} href={hrefFor(event.id)} />
              ))}
            </Slot>
          );
        })}
      </div>
    </div>
  );
}

function Slot({
  label,
  filled,
  children,
}: {
  label: string;
  filled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-stretch border-b border-line",
        filled ? "min-h-[56px]" : "min-h-[44px]",
      )}
    >
      <span
        className="w-[90px] shrink-0 px-3 py-2.5 text-[12px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </span>
      <div
        className={cn(
          "min-w-0 flex-1 border-l border-line",
          filled && "flex flex-col gap-2 px-3 py-2",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Card({ event, href }: { event: CalendarEvent; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-control border px-3 py-2 no-underline"
      style={{ ...eventCard(event.kind), color: "var(--ink)" }}
    >
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

      {event.requestTitle ? (
        <RequestChip title={event.requestTitle} kind="Request" onCard />
      ) : null}

      {event.clientName ? <RequestChip title={event.clientName} kind="Client" onCard /> : null}
    </Link>
  );
}
