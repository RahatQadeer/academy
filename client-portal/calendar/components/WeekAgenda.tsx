import { Fragment } from "react";
import type { CalendarItem } from "@/client-portal/types";
import { byDay, dayHeading } from "@/client-portal/lib/calendar-view";
import { EventRow } from "./EventRow";

/**
 * The week, as a day-by-day agenda — Whitby's Screen 8, read for the client.
 *
 * A client's week is a handful of appointments, and a seven-column time grid
 * would spend most of its pixels on the empty hours between them. Days with
 * nothing on them are skipped for the same reason.
 */
export function WeekAgenda({
  items,
  timeZone,
  hrefFor,
}: {
  items: CalendarItem[];
  timeZone: string;
  hrefFor: (id: string) => string;
}) {
  const days = byDay(items, timeZone);

  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      {days.length === 0 ? (
        <div
          className="flex min-h-[180px] items-center justify-center px-6 text-center text-[13px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Nothing on this week. Calls, appointments and key dates your team shares
          with you appear here, with the events from any calendar you connect.
        </div>
      ) : (
        <div className="flex flex-col [&>*:last-child]:border-b-0">
          {days.map(({ key, day, items: onThatDay }) => (
            <Fragment key={key}>
              <div
                className="border-b border-line px-4 py-2.5 text-[12.5px] font-semibold"
                style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
              >
                {dayHeading(day, timeZone)}
              </div>

              {onThatDay.map((item) => (
                <EventRow key={item.id} item={item} timeZone={timeZone} href={hrefFor(item.id)} />
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
