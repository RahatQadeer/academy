import Link from "next/link";
import { weeksOf, type CalendarWindow } from "@/whitbyos/lib/calendar";
import { isoDateIn, partsIn } from "@/whitbyos/lib/zoned";
import type { CalendarItem } from "@/client-portal/types";
import { itemsOn } from "@/client-portal/lib/calendar-view";
import { chipStyle } from "./vocab";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A cell has room for three chips before the day number is pushed out of it. */
const CHIPS_PER_CELL = 3;

/**
 * The month, as a grid of its weeks — Whitby's Screen 8b.
 *
 * Days outside the month are drawn as inert grey ground rather than as the
 * neighbouring month's dates, as Whitby draws them: the point of the row is the
 * shape of the weeks. The day number opens that day; a chip opens its event.
 *
 * Under 640px the seven columns keep their width and the grid scrolls
 * sideways, as the portal's tables do, rather than crushing each day to a
 * sliver no chip fits in.
 */
export function MonthGrid({
  items,
  window,
  timeZone,
  today,
  dayHrefFor,
  eventHrefFor,
  under,
}: {
  items: CalendarItem[];
  window: CalendarWindow;
  timeZone: string;
  today: string;
  dayHrefFor: (iso: string) => string;
  eventHrefFor: (id: string) => string;
  /**
   * Drawn in each day under what is booked in it, where the screen has
   * something else to put there — the task due dates, when they are switched
   * on. The grid stays a grid of events and knows nothing about them.
   */
  under?: (iso: string) => React.ReactNode;
}) {
  const weeks = weeksOf(window, timeZone);

  return (
    <div className="overflow-x-auto rounded-[8px] border border-line">
      <div className="min-w-[640px]">
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

        {weeks.map((week) => (
          <div key={isoDateIn(week[0], timeZone)} className="grid grid-cols-7">
            {week.map((day) => {
              const iso = isoDateIn(day, timeZone);
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

              const onThatDay = itemsOn(items, day, timeZone);
              const shown = onThatDay.slice(0, CHIPS_PER_CELL);
              const hidden = onThatDay.length - shown.length;
              const isToday = iso === today;

              return (
                <div key={iso} className="min-h-[104px] overflow-hidden border border-line px-2 py-1.5">
                  <Link
                    href={dayHrefFor(iso)}
                    aria-label={`Open ${iso}`}
                    className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full px-1 text-[12px] font-medium no-underline"
                    style={
                      isToday
                        ? { background: "var(--ink)", color: "var(--surface)" }
                        : { color: "var(--ink)" }
                    }
                  >
                    {partsIn(day, timeZone).day}
                  </Link>

                  {shown.map((item) => (
                    <Link
                      key={item.id}
                      href={eventHrefFor(item.id)}
                      scroll={false}
                      title={[item.title, item.requestTitle].filter(Boolean).join(" · ")}
                      className="mt-[3px] block truncate rounded-[3px] px-[5px] py-0.5 text-[10.5px] no-underline"
                      style={{
                        ...chipStyle(item),
                        textDecoration: item.personal?.declined ? "line-through" : undefined,
                      }}
                    >
                      {item.title}
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
