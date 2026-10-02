"use client";

import { SubmitPlain } from "@/base/components/Submit";

import Link from "next/link";
import { OwnerAvatar } from "@/whitbyos/components/OwnerAvatar";
import { useState } from "react";
import { cn } from "@/base/lib/cn";
import { shortDate } from "@/whitbyos/lib/format";
import { streamInk as planStreamInk, streamTint } from "@/whitbyos/lib/plan-ink";
import { toggleTask } from "@/whitbyos/work-plans/actions";
import { DragTask, DropColumn } from "@/whitbyos/work-plans/[id]/components/DragTasks";
import { workstreamStatusLabel } from "@/whitbyos/lib/workstream-status";
import { laneOf } from "@/whitbyos/lib/kanban";
import type { PlanTask, PlanWorkstream } from "@/whitbyos/lib/work-plans";
import { peopleOnTask } from "@/whitbyos/lib/task-people";

const DONE = new Set(["complete", "completed", "done"]);

/**
 * The one colour on a Work Stream's row.
 *
 * WP.17 writes the state as a word rather than a pill, so the state has to
 * carry itself: green finished, the deep blue of the info tone while running,
 * amber waiting, red blocked, and grey for a stream nobody has started.
 */
function streamInk(stream: PlanWorkstream) {
  if (stream.blocked) return "var(--danger-text)";
  if (DONE.has(stream.status.toLowerCase())) return "var(--success-fg)";
  if (stream.status === "waiting") return "var(--warning-fg)";
  if (stream.status === "not_started") return "var(--text-tertiary)";
  return "var(--info-fg)";
}

/**
 * WP.17's Work Streams — each its own card, numbered, with the share of its own
 * tasks that are done.
 *
 * A stream carrying work still to do opens on arrival, so what needs attention
 * is visible without hunting for it. A plan with no tasks anywhere opens its
 * first unfinished stream instead, otherwise every route to the plan's first
 * task sits behind a click with nothing on screen suggesting it.
 *
 * The ⋯ opens WP.17u, this stream's visibility, and a task row opens WP.18.
 * Both are links: the dialogs live in the URL, so they survive a refresh and
 * open in a new tab like anything else.
 *
 * The ⋯ used to open WP.19 instead. v2 of the export gives it to visibility
 * and reaches Edit Work Stream by clicking the stream's name in edit mode
 * (WP.17z), which is where WP.19 is opened from now.
 */
export function WorkStreamList({
  streams,
  planId,
  basePath,
  rowActions,
}: {
  streams: PlanWorkstream[];
  planId: string;
  /** The plan's own path; the dialogs hang off it as query strings. */
  basePath: string;
  /**
   * Edit and ✕ on every task row.
   *
   * WP.6, WP.11 and WP.14 draw them — the screens where a plan has just been
   * built and is being gone over before it is adopted. WP.17 does not: a
   * running plan is worked rather than rewritten, and a remove control on
   * every row of it is an accident waiting for a Friday afternoon.
   */
  rowActions?: boolean;
}) {
  const unfinished = streams.filter(
    (stream) => !DONE.has(stream.status.toLowerCase()),
  );

  /**
   * The one being worked, which is the one the plan opens on.
   *
   * A freshly drafted plan is six or seven Work Streams and forty tasks, and
   * it was all opened out at once — the phase somebody is actually on was
   * somewhere in the middle of it. The current one is the first that has been
   * started and is not finished; failing that the first unfinished one; and on
   * a plan where everything is done, the last, because that is where the work
   * ended.
   */
  const current =
    unfinished.find((stream) => stream.status !== "not_started") ??
    unfinished[0] ??
    streams[streams.length - 1] ??
    null;

  /* The rest are a press away rather than gone: a plan is a whole thing and
     the point of reading one is often the shape of all of it. */
  const [all, setAll] = useState(false);

  const shown = all || !current ? streams : streams.filter((stream) => stream.id === current.id);
  const hidden = streams.length - shown.length;

  const [open, setOpen] = useState<string[]>(current ? [current.id] : []);

  function toggle(id: string) {
    setOpen((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {shown.map((stream, index) => {
        const expanded = open.includes(stream.id);
        const complete = DONE.has(stream.status.toLowerCase());
        const started = complete || stream.status !== "not_started";


        return (
          <div
            key={stream.id}
            className="overflow-hidden rounded-card border transition-shadow hover:shadow-[0_2px_10px_-4px_rgba(15,15,15,.16)]"
            style={{
              borderColor: expanded ? "var(--border-strong)" : "var(--border)",
              background: "var(--surface)",
              boxShadow: "0 1px 2px rgba(15,15,15,.04)",
            }}
          >
            {/*
             * The head of the card, in two columns rather than one row.
             *
             * Everything used to sit on one centred line, so with a purpose
             * under the name the status and the buttons floated between the
             * two lines — level with neither, and reading as though they had
             * slipped. They belong to the name, so they sit against the name,
             * and the purpose runs under both.
             */}
            <div
              className="flex items-start gap-3 px-3.5 py-3"
              style={expanded ? { background: "var(--surface-soft)" } : undefined}
            >
              <button
                type="button"
                onClick={() => toggle(stream.id)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
              >
                <span
                  className="mt-[5px] shrink-0 text-[11px]"
                  style={{ color: "var(--text-quiet)" }}
                  aria-hidden
                >
                  {expanded ? "▾" : "▸"}
                </span>

                {/* Each stream's own colour, so the same stream is the same
                    hue here, in the Table and on the Kanban. It was blue for
                    every started stream and the canvas grey for every other,
                    which on a plan nobody has begun is five identical squares.
                    Stronger once the stream is under way. */}
                <span
                  className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[11.5px] font-bold"
                  style={
                    started
                      ? { background: planStreamInk(index), color: "#fff" }
                      : { background: streamTint(index), color: planStreamInk(index) }
                  }
                >
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {stream.name}
                  </span>
                  {stream.purpose ? (
                    <span
                      className="mt-0.5 block truncate text-[12.5px] font-normal"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {stream.purpose}
                    </span>
                  ) : null}
                </span>

              </button>

              {/*
               * The three controls, one height, level with the name.
               *
               * The status was inside the disclosure button and the other two
               * were outside it with padding of their own, so three things
               * that read as a group were laid out by three different rules.
               * One row now, 28px tall, and the ⋯ is a bordered square like
               * its neighbour rather than three grey dots in the margin — it
               * opens the stream's visibility, which is not a decoration.
               */}
              <div className="flex shrink-0 items-center gap-2">
                {/* The status as a word, which is how WP.17 draws it — a pill
                    here would be the fourth tinted block in one row. */}
                <span
                  className="mr-0.5 text-[12.5px] font-medium"
                  style={{ color: streamInk(stream) }}
                >
                  {workstreamStatusLabel(stream.status, stream.blocked)}
                </span>

                {/* WP.17g — the stream on its own, with its own views. */}
                <Link
                  href={`${basePath}/streams/${stream.id}`}
                  aria-label={`Open ${stream.name}`}
                  title={`Open ${stream.name}`}
                  className="inline-flex h-7 items-center rounded-control border px-2.5 text-[12px] font-medium no-underline transition-colors hover:bg-[var(--accent-tint)]"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  Open ↗
                </Link>

                <Link
                  href={`${basePath}?visibility=stream&vstream=${stream.id}`}
                  scroll={false}
                  aria-label={`Visibility for ${stream.name}`}
                  title={`Visibility for ${stream.name}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-control border text-[14px] leading-none no-underline transition-colors hover:bg-[var(--surface-active)]"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
                >
                  ⋯
                </Link>
              </div>
            </div>

            {expanded ? (
              /* Dropping a task here files it under this Work Stream, and
                 where it lands among the others is the order it keeps. */
              <DropColumn
                planId={planId}
                group="stream"
                lane={stream.id}
                className="flex flex-col gap-0.5 border-t px-3 pb-2.5 pt-1 sm:pl-10 sm:pr-3"
                style={{ borderColor: "var(--canvas)" }}
              >
                {stream.tasks.map((task) => (
                  <DragTask key={task.id} id={task.id} row>
                    <TaskRow
                      task={task}
                      planId={planId}
                      basePath={basePath}
                      rowActions={rowActions}
                    />
                  </DragTask>
                ))}

                <Link
                  href={`${basePath}?task=new&stream=${stream.id}`}
                  scroll={false}
                  className="px-2 py-1.5 text-[12.5px] no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  + Add task
                </Link>
              </DropColumn>
            ) : null}
          </div>
        );
      })}

      {/* And the rest of the plan, on a press. */}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-dashed py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
          style={{ borderColor: "var(--border)", color: "var(--accent)" }}
        >
          View {hidden} more Work Stream{hidden === 1 ? "" : "s"}
        </button>
      ) : null}

      {all && streams.length > 1 ? (
        <button
          type="button"
          onClick={() => setAll(false)}
          className="self-center text-[12.5px] font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Show only the current Work Stream
        </button>
      ) : null}
    </div>
  );
}

/**
 * One task inside a Work Stream, as WP.6 draws it.
 *
 * A task with a checklist becomes its own bordered card carrying an n/N count;
 * one without stays a single line. Both are laid out the same way — state, then
 * title, then the owner's avatar and the date at a fixed width so the dates
 * line up down the stream.
 */
function TaskRow({
  task,
  planId,
  basePath,
  rowActions,
}: {
  task: PlanTask;
  planId: string;
  basePath: string;
  rowActions?: boolean;
}) {
  // The same reading the Kanban uses, so the two screens cannot disagree about
  // one task — the List had "waiting" down as under way and the board had it
  // in the Waiting lane, over the same row.
  const lane = laneOf(task.status);
  const done = lane === "complete";
  const running = lane === "in_progress";
  const waiting = lane === "waiting";
  const ticked = task.checklist.filter((item) => item.done).length;

  /*
   * More than one person's work, from both places it can be decided.
   *
   * Counted off the steps, because that is where drafting divides a task — and
   * off the assignees, because handing one to two people divides it without
   * touching a step. Reading only the steps drew one avatar over a task two
   * names were on.
   */
  const hands = new Set([
    ...peopleOnTask(task.ownerUserId, task.checklist).map((person) => person.userId),
    ...task.assigneeIds,
  ]).size;

  const state = (
    <form action={toggleTask} className="flex shrink-0 items-center">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="task_id" value={task.id} />
      <SubmitPlain
       
        aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        title={done ? "Mark not done" : "Mark done"}
        className={cn(
          "flex items-center justify-center",
          done || running || waiting
            ? "text-[13px]"
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
        {/* Four readings, three marks: finished, under way, waiting on
            somebody, the same half-circle in the Kanban's amber rather than
            its blue, and an empty ring for work nobody has started. */}
        {done ? "✓" : running ? "◐" : waiting ? "◐" : ""}
      </SubmitPlain>
    </form>
  );

  const meta = (
    <div className="flex shrink-0 items-center gap-1.5">
      {task.ownerInitials ? (
        <OwnerAvatar
          name={task.ownerName}
          initials={task.ownerInitials}
          userId={task.ownerUserId}
          hasPhoto={task.ownerHasPhoto}
          size={20}
        />
      ) : (
        <span className="h-5 w-5 shrink-0" aria-hidden />
      )}
      {/*
       * Columns, not a float — every slot always present so rows line up.
       * Kept tight beside the title rather than stretched to the far edge:
       * on a wide plan the empty middle used to read as broken layout.
       */}
      <span className="inline-flex w-[58px] shrink-0 justify-end">
        {hands > 1 ? (
          <span
            className="rounded-[9px] px-[6px] py-px text-[10.5px] font-medium"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
            title={`${hands} people share this task`}
          >
            {hands} people
          </span>
        ) : null}
      </span>

      <span
        className="w-7 shrink-0 text-right text-[11px]"
        style={{
          color: ticked === task.checklist.length ? "var(--success-fg)" : "var(--text-quiet)",
          fontVariantNumeric: "tabular-nums",
        }}
        title={
          task.checklist.length > 0
            ? `${ticked} of ${task.checklist.length} steps done`
            : undefined
        }
      >
        {task.checklist.length > 0 ? `${ticked}/${task.checklist.length}` : ""}
      </span>

      <span
        className="w-3 shrink-0 text-center text-[11px]"
        style={{ color: "var(--warning-fg)" }}
        title={
          task.blockedByTaskId || task.blockedByStreamId
            ? "Waiting on earlier work in this plan"
            : undefined
        }
      >
        {task.blockedByTaskId || task.blockedByStreamId ? "↳" : ""}
      </span>

      <span
        className="w-3 shrink-0 text-center text-[11px]"
        style={{ color: "var(--text-tertiary)" }}
        title={
          task.externalLinks?.some((resource) => resource.phone)
            ? "Has a contact number"
            : undefined
        }
      >
        {task.externalLinks?.some((resource) => resource.phone) ? "☎" : ""}
      </span>

      <span
        className="w-6 shrink-0 text-right text-[11.5px]"
        style={{ color: "var(--text-quiet)", fontVariantNumeric: "tabular-nums" }}
      >
        {task.estimatedDays ? `${task.estimatedDays}d` : ""}
      </span>

      <span
        className="w-[52px] shrink-0 text-right text-[12px]"
        style={{ color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}
      >
        {task.due_date ? shortDate(task.due_date) : ""}
      </span>

      <Link
        href={`${basePath}?task=${task.id}`}
        scroll={false}
        className="shrink-0 rounded-[5px] border px-2 py-[3px] text-[11px] no-underline"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        Edit
      </Link>

      {rowActions ? (
        <Link
          href={`${basePath}?task=${task.id}&remove=1`}
          scroll={false}
          title="Remove task"
          aria-label={`Remove ${task.title}`}
          className="shrink-0 px-0.5 text-[14px] font-bold no-underline"
          style={{ color: "var(--danger-text)" }}
        >
          ✕
        </Link>
      ) : null}
    </div>
  );

  /**
   * One row per task, whether or not it has steps.
   *
   * A task with a checklist used to open out into its own card with every
   * step listed under it. That was written when a checklist was something
   * somebody typed in by hand and most tasks had none; now Whitby writes five
   * or six for every task, so a plan of twenty tasks became a hundred and
   * twenty lines and the plan stopped being readable as a plan.
   *
   * The steps live on the task's own page, which draws them better and can
   * tick them. Here the row says how many there are and how many are done, and
   * the title opens them.
   */
  return (
    <div className="flex items-center gap-2 rounded-[6px] px-1.5 py-1.5 transition-colors hover:bg-[var(--surface-soft)]">
      {state}
      {/*
       * Title and meta as one cluster.
       *
       * Cap the title, keep dates and avatars beside it, and let leftover
       * width sit after the row — empty margin on the outside reads as
       * balance; empty margin between the words does not.
       */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Link
          href={`/whitbyos/work-plans/${planId}/tasks/${task.id}`}
          className="min-w-0 truncate text-[13.5px] no-underline"
          style={{
            flex: "1 1 auto",
            maxWidth: "min(100%, 34rem)",
            ...(done
              ? { color: "var(--text-secondary)", textDecoration: "line-through" }
              : { color: "var(--ink)" }),
          }}
        >
          {task.title}
        </Link>

        {/*
          * A task Whitby has made a start on says so here.
          *
          * The rail card listed the four it drafted and the rows themselves
          * said nothing, so the only way to tell a drafted task from an
          * untouched one was to open it, and the obvious reading of a card
          * headed "Whitby did this" was that those four were finished. They
          * are not: the circle is still empty and the status is unchanged,
          * which is exactly what this mark has to sit beside without
          * contradicting.
          */}
        {task.whitbyDraft ? (
          <span
            title="Whitby has written a first draft for this. The task is still open."
            className="shrink-0 rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            Draft
          </span>
        ) : null}
        {meta}
      </div>
    </div>
  );
}
