import { Fragment } from "react";
import { byDay, type CalendarEvent } from "@/whitbyos/lib/calendar";
import { dayHeading } from "@/whitbyos/lib/calendar-format";
import { EventRow } from "@/whitbyos/calendar/components/EventRow";

/**
 * Screen 8 — the week, as a day-by-day agenda rather than a seven-column grid.
 *
 * That is what the reference draws, and it is the right call for this product:
 * a coordinator's week is a handful of appointments spread across five days,
 * and a time grid would spend most of its pixels on the empty hours between
 * them. Days with nothing on them are skipped for the same reason.
 */
export function WeekAgenda({
  events,
  timezone,
  hrefFor,
  clientName,
}: {
  events: CalendarEvent[];
  timezone: string;
  hrefFor: (eventId: string) => string;
  /** The client workspace this week is being read in, where one is open. */
  clientName?: string | null;
}) {
  const days = byDay(events, timezone);

  return (
    <div className="flex-1 overflow-auto rounded-[8px] border border-line">
      {days.length === 0 ? (
        <div
          className="flex h-full min-h-[180px] items-center justify-center px-6 text-center text-[13px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {clientName
            ? `Nothing on this week for ${clientName}. Their appointments, meetings and key dates appear here, along with anything of your own. Choose All clients on Workspace Overview to see every client's.`
            : "Nothing on this week. Appointments, meetings and key dates appear here, the ones added in Whitby, and the ones from any calendar you connect."}
        </div>
      ) : (
        <div className="flex flex-col [&>*:last-child]:border-b-0">
          {days.map(({ key, day, events: onThatDay }) => (
            <Fragment key={key}>
              <div
                className="border-b border-line px-4 py-2.5 text-[12.5px] font-semibold"
                style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
              >
                {dayHeading(day, timezone)}
              </div>

              {onThatDay.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  timezone={timezone}
                  href={hrefFor(event.id)}
                />
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
