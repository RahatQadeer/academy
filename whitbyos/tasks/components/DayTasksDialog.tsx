import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { Modal } from "@/whitbyos/components/Modal";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import {
  isDone,
  priorityLabel,
  priorityTone,
  taskStatusLabel,
  taskStatusTone,
} from "@/whitbyos/lib/task-vocab";
import type { TaskRow } from "@/whitbyos/lib/tasks";

/**
 * What is due on one day, listed so a date can be opened without guessing
 * which truncated chip was meant.
 *
 * The month can only show a few titles in a cell. Clicking the day used to
 * hit whichever chip sat under the pointer and skip the rest. This is the
 * rest: every task on that date, and each one opens from here.
 */
export function DayTasksDialog({
  date,
  tasks,
  closeHref,
}: {
  /** YYYY-MM-DD */
  date: string;
  tasks: TaskRow[];
  closeHref: string;
}) {
  const title = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <Modal
      title={title}
      eyebrow={tasks.length === 1 ? "1 task due" : `${tasks.length} tasks due`}
      closeHref={closeHref}
      width={560}
      dense
    >
      {tasks.length === 0 ? (
        <p className="py-6 text-center text-[13.5px]" style={{ color: "var(--text-tertiary)" }}>
          Nothing is due this day.
        </p>
      ) : (
        <div className="flex flex-col">
          {tasks.map((task, index) => {
            const done = isDone(task.status);
            const priority = priorityLabel(task.priority);

            return (
              <Link
                key={task.id}
                href={`/whitbyos/tasks/${task.id}`}
                className="flex items-start gap-3 py-3 no-underline"
                style={{
                  borderTop: index === 0 ? undefined : "1px solid var(--border)",
                  color: "var(--ink)",
                  opacity: done ? 0.55 : undefined,
                }}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[14px] font-medium"
                    style={{ textDecoration: done ? "line-through" : undefined }}
                  >
                    {task.title}
                  </span>
                  {task.clientName || task.request_title ? (
                    <span
                      className="mt-0.5 block truncate text-[12.5px]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {[task.clientName, task.request_title].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>

                <span className="flex shrink-0 items-center pt-0.5">
                  {task.assignees.slice(0, 3).map((who, at) => (
                    <span key={who.userId} style={{ marginLeft: at === 0 ? 0 : -6 }}>
                      <OwnerAvatar
                        userId={who.userId}
                        initials={who.initials}
                        name={who.name}
                        hasPhoto={who.hasPhoto}
                        size={20}
                        ring={at > 0}
                      />
                    </span>
                  ))}
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  {priority ? <Pill tone={priorityTone(task.priority)}>{priority}</Pill> : null}
                  <Pill tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Pill>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
