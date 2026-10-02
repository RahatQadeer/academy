import Link from "next/link";

/** One task's due date, as a month cell draws it. */
export type DueTask = {
  id: string;
  title: string;
  done: boolean;
  overdue: boolean;
  /** Where the row goes — its Request, or the Tasks list for one with none. */
  href: string;
};

/** Two before the day number is pushed out of a cell that already has events. */
const SHOWN_PER_CELL = 2;

/**
 * Task due dates on the portal Calendar, under whatever is booked that day —
 * Whitby's `DayTasks`, minus the dragging.
 *
 * An event is a time somebody has to be somewhere; a task is work owed by the
 * end of a day. They share the day because the question a calendar is asked is
 * "what is that week like", and half an answer is how a deadline gets missed.
 *
 * Whitby's version is a drop target: a date is a place there, so moving a task
 * is how its date is changed. Here it is not. The client does not reschedule
 * the firm's work, and a task that looked draggable and refused would be worse
 * than one that never offered.
 */
export function DayTasks({ tasks, moreHref }: { tasks: DueTask[]; moreHref: string }) {
  if (tasks.length === 0) return null;

  const shown = tasks.slice(0, SHOWN_PER_CELL);
  const hidden = tasks.length - shown.length;

  return (
    <>
      {shown.map((task) => (
        <Link
          key={task.id}
          href={task.href}
          title={`Due: ${task.title}`}
          className="mt-[3px] flex items-center gap-1 truncate rounded-[3px] px-[5px] py-0.5 text-[10.5px] no-underline"
          style={{
            // Never an event's colourway: a deadline is not a booking, and the
            // one thing this row must not do is read as another appointment.
            background: task.overdue ? "var(--danger-bg)" : "var(--surface-subtle)",
            color: task.overdue ? "var(--danger-action-fg)" : "var(--text-soft)",
            textDecoration: task.done ? "line-through" : undefined,
          }}
        >
          <span aria-hidden>☑</span>
          <span className="truncate">{task.title}</span>
        </Link>
      ))}

      {hidden > 0 ? (
        <Link
          href={moreHref}
          className="mt-[3px] block px-[5px] text-[10.5px] no-underline"
          style={{ color: "var(--text-tertiary)" }}
        >
          +{hidden} more due
        </Link>
      ) : null}
    </>
  );
}
