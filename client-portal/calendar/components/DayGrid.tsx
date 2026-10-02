import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { hourLabel, hourOf } from "@/whitbyos/lib/calendar-format";
import { timeRange } from "@/client-portal/lib/format";
import type { CalendarItem } from "@/client-portal/types";
import { KindPill, RequestChip, SourceMark } from "./EventRow";
import { cardStyle } from "./vocab";

/** The hours Whitby draws before anything is on them. */
const FIRST_HOUR = 7;
const LAST_HOUR = 17;

/**
 * One day down an hour column — Whitby's Screen 8a.
 *
 * 7am to 5pm, stretched only as far as the day actually goes: an event at 6am
 * or 9pm pulls the column open to include it.
 */
export function DayGrid({
  items,
  timeZone,
  hrefFor,
}: {
  items: CalendarItem[];
  timeZone: string;
  hrefFor: (id: string) => string;
}) {
  const allDay = items.filter((item) => item.allDay);
  const timed = items.filter((item) => !item.allDay);

  const hoursUsed = timed.map((item) => hourOf(item.startAt, timeZone));
  const first = Math.min(FIRST_HOUR, ...hoursUsed);
  const last = Math.max(LAST_HOUR, ...hoursUsed);

  const hours: number[] = [];
  for (let hour = first; hour <= last; hour += 1) hours.push(hour);

  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      <div className="flex flex-col [&>*:last-child]:border-b-0">
        {allDay.length > 0 ? (
          <Slot label="All day" filled>
            {allDay.map((item) => (
              <Card key={item.id} item={item} timeZone={timeZone} href={hrefFor(item.id)} />
            ))}
          </Slot>
        ) : null}

        {hours.map((hour) => {
          const inThisHour = timed.filter((item) => hourOf(item.startAt, timeZone) === hour);

          return (
            <Slot key={hour} label={hourLabel(hour)} filled={inThisHour.length > 0}>
              {inThisHour.map((item) => (
                <Card key={item.id} item={item} timeZone={timeZone} href={hrefFor(item.id)} />
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
        className="w-[72px] shrink-0 px-3 py-2.5 text-[12px] sm:w-[90px]"
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

function Card({ item, timeZone, href }: { item: CalendarItem; timeZone: string; href: string }) {
  const declined = item.personal?.declined === true;

  return (
    <Link
      href={href}
      scroll={false}
      className="flex items-center gap-2.5 rounded-control border px-3 py-2 no-underline"
      style={{ ...cardStyle(item), color: "var(--ink)" }}
    >
      <SourceMark item={item} />

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[13.5px]",
            (item.kind === "key_date" || item.kind === "deadline") && "font-medium",
            declined && "line-through",
          )}
        >
          {item.title}
        </span>
        {item.allDay ? null : (
          <span className="block truncate text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
            {timeRange(item.startAt, item.endAt, timeZone)}
            {item.location ? ` · ${item.location}` : ""}
          </span>
        )}
      </span>

      <KindPill item={item} />

      {item.requestTitle ? <RequestChip title={item.requestTitle} onCard /> : null}
    </Link>
  );
}
