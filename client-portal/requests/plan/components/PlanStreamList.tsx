import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { TaskTickForm } from "@/client-portal/components/TaskDoneButton";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { shortDate } from "@/whitbyos/lib/format";
import { laneOf } from "@/whitbyos/lib/kanban";
import { workstreamStatusLabel } from "@/whitbyos/lib/workstream-status";
import type { PlanTask, PlanWorkstream } from "@/whitbyos/lib/work-plans";

const DONE = new Set(["complete", "completed", "done"]);

/** The one colour on a stream's row — the same reading as Whitby's `streamInk`. */
function streamInk(stream: PlanWorkstream) {
  if (stream.blocked) return "var(--danger-text)";
  if (DONE.has(stream.status.toLowerCase())) return "var(--success-fg)";
  if (stream.status === "waiting") return "var(--warning-fg)";
  if (stream.status === "not_started") return "var(--text-tertiary)";
  return "var(--info-fg)";
}

/**
 * WP.17's List, as the client reads it.
 *
 * Whitby's own `WorkStreamList` cannot be reused here: it is a client component
 * whose ticks are Whitby's server actions, and whose rows open the edit
 * dialog. This draws the same card — numbered, the purpose under the name, the
 * status as a coloured word, the tasks with the same three marks.
 *
 * With `tick`, each task's mark is the client's own checkbox instead, through
 * the portal's `setTaskDone` (client-portal/023) — completing or reopening the
 * task and nothing else. Without it, as for a view-only member, nothing on the
 * list writes.
 *
 * Opened and closed with `<details>`, so it needs no script. The streams that
 * start open are the ones Whitby opens: unfinished work with tasks in it, or
 * the first unfinished stream where no stream has any.
 */
export function PlanStreamList({
  streams,
  basePath,
  tick,
}: {
  streams: PlanWorkstream[];
  basePath: string;
  /** The Request the plan is on and the screen to come back to after a tick. */
  tick?: { requestId: string; returnTo: string };
}) {
  const unfinished = streams.filter((stream) => !DONE.has(stream.status.toLowerCase()));
  const withTasks = unfinished.filter((stream) => stream.tasks.length > 0);
  const open = new Set(
    (withTasks.length > 0 ? withTasks : unfinished.slice(0, 1)).map((stream) => stream.id),
  );

  return (
    <div className="flex flex-col gap-3.5">
      {streams.map((stream, index) => {
        const complete = DONE.has(stream.status.toLowerCase());
        const started = complete || stream.status !== "not_started";

        return (
          <details
            key={stream.id}
            open={open.has(stream.id)}
            className="group overflow-hidden rounded-card border border-line bg-surface"
          >
            <summary className="flex cursor-pointer list-none items-center group-open:bg-[var(--surface-soft)] [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 flex-1 items-center gap-2.5 py-3.5 pl-4">
                <span
                  className="shrink-0 text-[11px] transition-transform group-open:rotate-90"
                  style={{ color: "var(--text-quiet)" }}
                  aria-hidden
                >
                  ▸
                </span>

                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11.5px] font-bold"
                  style={
                    started
                      ? {
                          background: "var(--accent-tint)",
                          color: "var(--accent)",
                        }
                      : {
                          background: "var(--canvas)",
                          color: "var(--text-soft)",
                        }
                  }
                >
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">{stream.name}</span>
                  {stream.purpose ? (
                    <span
                      className="mt-0.5 block truncate text-[12.5px] font-normal"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {stream.purpose}
                    </span>
                  ) : null}
                </span>

                <span
                  className="shrink-0 text-[12.5px] font-medium"
                  style={{ color: streamInk(stream) }}
                >
                  {workstreamStatusLabel(stream.status, stream.blocked)}
                </span>
              </span>

              <Link
                href={`${basePath}/streams/${stream.id}`}
                aria-label={`Open ${stream.name}`}
                title={`Open ${stream.name}`}
                className="mx-4 shrink-0 rounded-control border px-2.5 py-1 text-[12px] no-underline"
                style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                Open ↗
              </Link>
            </summary>

            <div
              className="flex flex-col gap-0.5 border-t pb-3 pl-[50px] pr-4 pt-1"
              style={{ borderColor: "var(--canvas)" }}
            >
              {stream.tasks.length === 0 ? (
                <p className="px-2 py-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  No tasks in this Work Stream yet.
                </p>
              ) : (
                stream.tasks.map((task) => <TaskLine key={task.id} task={task} tick={tick} />)
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** One task: its state, its title, who owns it and when it is due. */
function TaskLine({
  task,
  tick,
}: {
  task: PlanTask;
  tick?: { requestId: string; returnTo: string };
}) {
  // The same reading the Kanban uses, so the two views agree about one task.
  const lane = laneOf(task.status);
  const done = lane === "complete";
  const running = lane === "in_progress";
  const waiting = lane === "waiting";

  return (
    <div className="flex items-center gap-2.5 px-2 py-2">
      {tick ? (
        <TaskTickForm
          taskId={task.id}
          done={done}
          returnTo={tick.returnTo}
          requestId={tick.requestId}
        />
      ) : (
        <span
          role="img"
          aria-label={done ? "Complete" : running ? "Running" : waiting ? "Waiting" : "Not started"}
          className={cn(
            "flex shrink-0 items-center justify-center",
            done || running || waiting
              ? "w-[14px] text-[13px]"
              : "h-[14px] w-[14px] rounded-full border-2 border-[var(--border-strong)]",
          )}
          style={
            done
              ? { color: "var(--success-fg)" }
              : running
                ? { color: "var(--accent)" }
                : waiting
                  ? { color: "var(--warning-fg)" }
                  : undefined
          }
        >
          {done ? "✓" : running || waiting ? "◐" : ""}
        </span>
      )}

      <span
        className="min-w-0 flex-1 truncate text-[13.5px]"
        style={
          done
            ? { color: "var(--text-secondary)", textDecoration: "line-through" }
            : { color: "var(--ink)" }
        }
        title={task.title}
      >
        {task.title}
      </span>

      {task.ownerInitials ? (
        <OwnerAvatar name={task.ownerName} initials={task.ownerInitials} userId={null} size={20} />
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}
      <span className="w-[60px] shrink-0 text-[12px]" style={{ color: "var(--text-disabled)" }}>
        {task.due_date ? shortDate(task.due_date) : ""}
      </span>
    </div>
  );
}
