"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rescheduleTask } from "@/whitbyos/tasks/actions";
import type { CalendarTask } from "@/whitbyos/tasks/components/TaskCalendar";

const MIME = "application/x-whitby-task";

/**
 * Task due dates on the workspace calendar, under whatever is booked that day.
 *
 * Appointments and tasks are different things and the calendar says so: an
 * event is a time somebody has to be somewhere, a task is work owed by the end
 * of a day. They share the day because the question people ask of a calendar
 * is "what is Tuesday like", and half an answer is how a deadline gets missed.
 *
 * Dragged the same way as on the Tasks calendar: a date is a place here, so
 * moving a task is how its date is changed.
 */
export function DayTasks({ iso, tasks }: { iso: string; tasks: CalendarTask[] }) {
  const router = useRouter();
  const [over, setOver] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        const taskId =
          event.dataTransfer.getData(MIME) || event.dataTransfer.getData("text/plain");
        setOver(false);
        if (!taskId) return;
        event.preventDefault();

        start(async () => {
          await rescheduleTask(taskId, iso);
          router.refresh();
        });
      }}
      className="mt-[3px] flex flex-col gap-[3px] rounded-[4px]"
      style={{
        background: over ? "var(--accent-tint)" : undefined,
        opacity: pending ? 0.6 : undefined,
        minHeight: 6,
      }}
    >
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={task.href}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(MIME, task.id);
            event.dataTransfer.setData("text/plain", task.id);
            event.dataTransfer.effectAllowed = "move";
          }}
          title={[task.title, task.clientName].filter(Boolean).join(" · ")}
          className="flex items-center gap-1 truncate rounded-[3px] px-[5px] py-0.5 text-[10.5px] no-underline"
          style={{
            background: task.done
              ? "var(--surface-active)"
              : task.overdue
                ? "var(--danger-bg)"
                : "var(--surface-soft)",
            color: task.done
              ? "var(--text-tertiary)"
              : task.overdue
                ? "var(--danger-text)"
                : "var(--text-secondary)",
            cursor: "grab",
            textDecoration: task.done ? "line-through" : undefined,
          }}
        >
          {/* A tick rather than a dot: this is work owed, not a time booked. */}
          <span aria-hidden>☑</span>
          <span className="min-w-0 truncate">{task.title}</span>
        </Link>
      ))}
    </div>
  );
}
