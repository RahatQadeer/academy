import Link from "next/link";
import { eventsOn, weeksOf, type CalendarEvent, type CalendarWindow } from "@/whitbyos/lib/calendar";
import { eventChip } from "@/whitbyos/lib/calendar-vocab";
import { isoDateIn, partsIn } from "@/whitbyos/lib/zoned";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A cell has room for three chips before the day number is pushed out of it. */
const CHIPS_PER_CELL = 3;

/**
 * Screen 8b — the month.
 *
 * Days outside the month are drawn as inert grey ground rather than as the
 * neighbouring month's dates, which is how the reference draws them: the point
 * of the row is the shape of the weeks, and a live 31st of February's-worth of
 * March at the top of April invites a click that lands somewhere unexpected.
 */
export function MonthGrid({
  events,
  window,
  timezone,
  dayHrefFor,
  eventHrefFor,
  under,
}: {
  events: CalendarEvent[];
  window: CalendarWindow;
  timezone: string;
  dayHrefFor: (iso: string) => string;
  eventHrefFor: (eventId: string) => string;
  /**
   * Drawn in each day under what is booked in it, where the screen has
   * something else to put there — the task due dates, when they are switched
   * on. The grid stays a grid of events and knows nothing about them.
   */
  under?: (iso: string) => React.ReactNode;
}) {
  const weeks = weeksOf(window, timezone);

  return (
    /* Seven days never fit a phone. The grid keeps a floor and the frame
       around it scrolls, rather than clipping the last three columns and
       every chip on them — the portal's month grid has done this since it
       was written. */
    <div className="flex flex-1 flex-col overflow-x-auto rounded-[8px] border border-line [&>*]:min-w-[640px]">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="p-2 text-center text-[11px] font-semibold uppercase tracking-[0.03em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {weeks.map((week) => (
          <div key={isoDateIn(week[0], timezone)} className="grid grid-cols-7">
            {week.map((day) => {
              const iso = isoDateIn(day, timezone);
              const outside =
                day.getTime() < window.rangeStart.getTime() ||
                day.getTime() >= window.rangeEnd.getTime();

              if (outside) {
                return (
                  <div
                    key={iso}
                    className="min-h-[104px] border border-line"
                    style={{ background: "var(--surface-subtle)" }}
                  />
                );
              }

              const onThatDay = eventsOn(events, day, timezone);
              const shown = onThatDay.slice(0, CHIPS_PER_CELL);
              const hidden = onThatDay.length - shown.length;

              return (
                <div key={iso} className="min-h-[104px] overflow-hidden border border-line px-2 py-1.5">
                  <Link
                    href={dayHrefFor(iso)}
                    className="block text-[12px] font-medium no-underline"
                    style={{ color: "var(--ink)" }}
                  >
                    {partsIn(day, timezone).day}
                  </Link>

                  {shown.map((event) => (
                    <Link
                      key={event.id}
                      href={eventHrefFor(event.id)}
                      title={[event.title, event.requestTitle, event.clientName]
                        .filter(Boolean)
                        .join(" · ")}
                      className="mt-[3px] block truncate rounded-[3px] px-[5px] py-0.5 text-[10.5px] no-underline"
                      style={eventChip(event.kind)}
                    >
                      {event.title}
                    </Link>
                  ))}

                  {under?.(iso)}

                  {hidden > 0 ? (
                    <Link
                      href={dayHrefFor(iso)}
                      className="mt-[3px] block px-[5px] text-[10.5px] no-underline"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      +{hidden} more
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
