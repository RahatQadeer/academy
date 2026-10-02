"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { rescheduleTask } from "@/whitbyos/tasks/actions";

/** What the drag carries, so nothing else dropped on a day is mistaken for it. */
const MIME = "application/x-whitby-task";

export type CalendarTask = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  priority: string | null;
  clientName: string | null;
  href: string;
  done: boolean;
  overdue: boolean;
  /** Due today or in the next two days: close enough to be worth saying. */
  soon?: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Screen 7c — the month, with tasks on the day they are due.
 *
 * A task's date was a column in a table, which answers "when is this due" and
 * never "what does next Tuesday look like". The month answers the second, and
 * because a date is a place here, moving a task across it is how the date is
 * changed: the gesture is the edit.
 *
 * Work with no date is not drawn here at all. A column of everything that is
 * not on the calendar, beside the calendar, is a second list rather than a
 * month: undated work is the List's business, and this is the month's.
 */
export function TaskCalendar({
  month,
  tasks,
  timezone,
  calendarHref,
  selectedDay,
}: {
  /** First day of the month being drawn, as an ISO date. */
  month: string;
  tasks: CalendarTask[];
  timezone: string;
  /** The month's own address; a day is added as `day=`. */
  calendarHref: string;
  selectedDay?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const first = new Date(`${month}T00:00:00Z`);
  const year = first.getUTCFullYear();
  const index = first.getUTCMonth();

  // Monday-first, which is how a working week is read.
  const lead = (new Date(Date.UTC(year, index, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const cells = Math.ceil((lead + days) / 7) * 7;

  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: timezone });

  const onDay = (iso: string) => tasks.filter((task) => task.dueDate === iso);

  const move = (taskId: string, date: string | null) =>
    start(async () => {
      setFailed(null);
      const result = await rescheduleTask(taskId, date);
      if (!result.ok) setFailed(result.error ?? "That did not move.");
      else router.refresh();
    });

  const dropProps = (iso: string | null) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes(MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setOver(iso ?? "none");
    },
    onDragLeave: () => setOver(null),
    onDrop: (event: React.DragEvent) => {
      const taskId =
        event.dataTransfer.getData(MIME) || event.dataTransfer.getData("text/plain");
      setOver(null);
      if (!taskId) return;
      event.preventDefault();
      move(taskId, iso);
    },
  });

  const overdue = tasks.filter((task) => task.overdue);
  const dueToday = tasks.filter((task) => task.dueDate === todayIso && !task.done);
  const soon = tasks.filter((task) => task.soon && task.dueDate !== todayIso);

  return (
    <div className="flex flex-col gap-4" style={{ opacity: pending ? 0.75 : undefined }}>
      {/*
       * What is pressing, before the month is read.
       *
       * A grid of thirty days answers "when", and somebody opening it wants
       * "what now" first. Overdue, then today, then the next two days, and
       * nothing at all where none of the three applies.
       */}
      {overdue.length + dueToday.length + soon.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {overdue.length > 0 ? (
            <Alert
              tone={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
              label={`${overdue.length} overdue`}
              detail={overdue
                .slice(0, 3)
                .map((task) => task.title)
                .join(", ")}
            />
          ) : null}

          {dueToday.length > 0 ? (
            <Alert
              tone={{ background: "var(--avatar-orange-bg)", color: "var(--avatar-orange-fg)" }}
              label={`${dueToday.length} due today`}
              detail={dueToday
                .slice(0, 3)
                .map((task) => task.title)
                .join(", ")}
            />
          ) : null}

          {soon.length > 0 ? (
            <Alert
              tone={{ background: "var(--accent-tint)", color: "var(--accent)" }}
              label={`${soon.length} due in the next two days`}
              detail={soon
                .slice(0, 3)
                .map((task) => task.title)
                .join(", ")}
            />
          ) : null}
        </div>
      ) : null}

    <div className="flex flex-col gap-4">
      {/* Same as the Calendar's month grid: the columns keep a floor and
          the frame scrolls. */}
      <div className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-line [&>*]:min-w-[640px]">
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

        <div className="grid grid-cols-7">
          {Array.from({ length: cells }, (_, cell) => {
            const day = cell - lead + 1;
            const inside = day >= 1 && day <= days;

            if (!inside) {
              return (
                <div
                  key={cell}
                  className="min-h-[108px] border border-line"
                  style={{ background: "var(--surface-subtle)" }}
                />
              );
            }

            const iso = `${year}-${String(index + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const today = iso === todayIso;
            const selected = iso === selectedDay;
            const here = onDay(iso);
            const dayHref = `${calendarHref}${calendarHref.includes("?") ? "&" : "?"}day=${iso}`;

            return (
              <div
                key={cell}
                {...dropProps(iso)}
                className="relative min-h-[108px] overflow-hidden border px-1.5 py-1.5"
                style={{
                  borderColor: today || selected ? "var(--accent)" : "var(--chrome-line)",
                  background: over === iso
                    ? "var(--accent-tint)"
                    : today || selected
                      ? "var(--accent-tint)"
                      : undefined,
                  boxShadow: today || selected ? "inset 0 0 0 1px var(--accent)" : undefined,
                }}
              >
                {/*
                 * The day itself is what opens the list.
                 *
                 * A chip used to be a link to one task, so a cell with six
                 * due that day only ever opened whichever title sat under
                 * the pointer. The rest of the cell — the number, the count,
                 * the empty padding — goes to every task on this date.
                 */}
                {here.length > 0 ? (
                  <Link
                    href={dayHref}
                    aria-label={`${here.length} ${here.length === 1 ? "task" : "tasks"} due ${iso}`}
                    className="absolute inset-0 z-[1]"
                  />
                ) : null}

                <div className="pointer-events-none relative z-[2] mb-1 flex items-center justify-between px-0.5">
                  {today ? (
                    <span
                      className="flex h-[21px] min-w-[21px] items-center justify-center rounded-full px-1 text-[12px] font-bold"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      {day}
                    </span>
                  ) : (
                    <span className="text-[12px] font-medium" style={{ color: "var(--ink)" }}>
                      {day}
                    </span>
                  )}
                  {here.length > 0 ? (
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      {here.length}
                    </span>
                  ) : null}
                </div>

                <div className="relative z-[3] flex flex-col gap-[3px]">
                  {here.map((task) => (
                    <Chip key={task.id} task={task} dayHref={dayHref} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {failed ? (
        <p className="text-[11.5px]" style={{ color: "var(--danger-text)" }}>
          {failed}
        </p>
      ) : null}
    </div>
    </div>
  );
}

/** One line of "this needs you", with the first few names behind it. */
function Alert({
  tone,
  label,
  detail,
}: {
  tone: { background: string; color: string };
  label: string;
  detail: string;
}) {
  return (
    <span
      title={detail}
      className="rounded-full px-3 py-[5px] text-[12px] font-semibold"
      style={tone}
    >
      {label}
    </span>
  );
}

/**
 * One task, where it is due: carried by its id, listed by the day.
 *
 * Dragging a link and letting go over a drop target still counts as a click in
 * some browsers, so a task dropped on the 19th also opened itself. The press
 * that ends a drag is swallowed. A click that is a click opens the day's list
 * rather than this one task, because a truncated chip is not a choice.
 */
function Chip({ task, dayHref }: { task: CalendarTask; dayHref: string }) {
  const dragged = useRef(false);

  const tone = task.done
    ? { background: "var(--surface-active)", color: "var(--text-tertiary)" }
    : task.overdue
      ? { background: "var(--danger-bg)", color: "var(--danger-text)" }
      : task.soon
        ? { background: "var(--avatar-orange-bg)", color: "var(--avatar-orange-fg)" }
        : { background: "var(--accent-tint)", color: "var(--accent)" };

  return (
    <Link
      href={dayHref}
      draggable
      onDragStart={(event) => {
        dragged.current = true;
        event.dataTransfer.setData(MIME, task.id);
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          dragged.current = false;
        }, 60);
      }}
      onClick={(event) => {
        if (dragged.current) event.preventDefault();
      }}
      title={[task.title, task.clientName].filter(Boolean).join(" · ")}
      className="block truncate rounded-[4px] px-[5px] py-[2px] text-[10.5px] no-underline"
      style={{
        ...tone,
        cursor: "grab",
        textDecoration: task.done ? "line-through" : undefined,
      }}
    >
      {task.overdue ? <span aria-hidden>! </span> : task.soon ? <span aria-hidden>• </span> : null}
      {task.title}
    </Link>
  );
}
