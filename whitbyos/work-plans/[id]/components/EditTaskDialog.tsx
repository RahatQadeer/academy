"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import { saveTask } from "@/whitbyos/work-plans/actions";
import { TASK_PRIORITY, TASK_STATUS, normaliseStatus } from "@/whitbyos/lib/task-vocab";
import type {
  Assignee,
  ChecklistItem,
  DependencyOption,
  PlanTask,
  PlanWorkstream,
  TaskEdit,
} from "@/whitbyos/lib/work-plans";
import { TaskBriefing } from "@/whitbyos/work-plans/[id]/components/TaskBriefing";

/**
 * WP.18 — Edit Task.
 *
 * SRS §6.7.1 gives a Task an owner, collaborators, status, priority, due date,
 * waiting state, dependency, next action and completion evidence. The reference
 * edits four of those — name, Work Stream, assignee, due date — plus a
 * checklist, and leaves the rest untouched rather than blanking them.
 *
 * A client component only because the checklist adds and removes rows. The
 * dialog still opens and closes through the URL like the rest of Whitby's
 * dialogs, so a refresh keeps it open and Cancel is an ordinary link.
 */
export function EditTaskDialog({
  planId,
  task,
  briefing,
  streams,
  assignees,
  dependencies,
  defaultStreamId,
  planTargetDate,
  closeHref,
  error,
}: {
  planId: string;
  /** Absent when the dialog is opened to add a Task rather than edit one. */
  task: TaskEdit | null;
  /**
   * The same task as the plan holds it, carrying what Whitby worked out about
   * it. Separate from `task` because that is the form's shape — the fields
   * somebody types into — and this is the draft's reasoning, which is read.
   */
  briefing?: PlanTask | null;
  streams: PlanWorkstream[];
  assignees: Assignee[];
  dependencies: DependencyOption[];
  defaultStreamId?: string;
  /** yyyy-mm-dd, so a due date past it can be pointed out while it is typed. */
  planTargetDate?: string | null;
  closeHref: string;
  error?: string;
}) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    task?.checklist ?? [],
  );
  const [due, setDue] = useState(task?.due_date ?? "");

  // A task cannot be due after the plan is meant to be finished without one of
  // the two being wrong. Which one is not for this dialog to decide, so it
  // says so and lets the date stand — the professional may well know something
  // the target date does not.
  const pastTarget = Boolean(due && planTargetDate && due > planTargetDate);

  function update(index: number, patch: Partial<ChecklistItem>) {
    setChecklist((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <Modal title={task ? "Edit Task" : "New Task"} closeHref={closeHref} width={520}>
      {/* Above the form: this is the context for what is being edited, and it
          is read rather than answered. */}
      {briefing ? <TaskBriefing task={briefing} /> : null}

      <form action={saveTask} className="flex flex-col gap-4">
        <input type="hidden" name="plan_id" value={planId} />
        {/* Where this dialog was opened from. Saving used to land on the plan
            wherever it came from, so editing a task you were reading took you
            away from it. The server only honours paths inside this plan. */}
        <input type="hidden" name="return_to" value={closeHref.split("?")[0]} />
        {task ? <input type="hidden" name="task_id" value={task.id} /> : null}

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Task Name" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            defaultValue={task?.title ?? ""}
            placeholder="What needs doing"
            className={CONTROL}
          />
        </Field>

        <Field label="Work Stream" htmlFor="workstream_id">
          <select
            id="workstream_id"
            name="workstream_id"
            required
            defaultValue={task?.workstream_id ?? defaultStreamId ?? ""}
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          >
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {stream.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex gap-3">
          <Field label="Assignee" htmlFor="owner_user_id" className="flex-1">
            <select
              id="owner_user_id"
              name="owner_user_id"
              defaultValue={task?.owner_user_id ?? ""}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            >
              <option value="">Unassigned</option>
              {assignees.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due Date" htmlFor="due_date" className="flex-1">
            <input
              id="due_date"
              name="due_date"
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              aria-describedby={pastTarget ? "due-past-target" : undefined}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            />
            {pastTarget ? (
              <span
                id="due-past-target"
                className="text-[11.5px] leading-[1.4]"
                style={{ color: "var(--warning-fg)" }}
              >
                After the plan&apos;s target of {formatTarget(planTargetDate!)}. Save it
                anyway, or move the plan&apos;s target date.
              </span>
            ) : null}
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Status" htmlFor="status" className="flex-1">
            <select
              id="status"
              name="status"
              defaultValue={task ? normaliseStatus(task.status) : "not_started"}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            >
              {TASK_STATUS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" htmlFor="priority" className="flex-1">
            <select
              id="priority"
              name="priority"
              defaultValue={task?.priority ?? "medium"}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            >
              {TASK_PRIORITY.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Next Action" htmlFor="next_action">
          <input
            id="next_action"
            name="next_action"
            defaultValue={task?.next_action ?? ""}
            placeholder="The immediate next step"
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          />
        </Field>

        <Field label="Dependency" htmlFor="dependency">
          <select
            id="dependency"
            name="dependency"
            defaultValue={task?.dependency ?? ""}
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          >
            <option value="">None</option>
            {dependencies.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {/* SRS 7.1.5 — client-visible Tasks are permissioned on their own.
            The prior value rides along so an unticked box can tell "take it
            back" from "it was never shared". */}
        <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--ink)" }}>
          <input
            type="checkbox"
            name="client_visible"
            value="1"
            defaultChecked={task?.visibility === "client_visible"}
            className="mt-[3px]"
            style={{ accentColor: "var(--accent)" }}
          />
          <span>
            Visible to the client
            <span
              className="block text-[11.5px] leading-[1.4]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Shows on this Request in their portal and in their Action
              Needed, even when the plan itself is not shared.
            </span>
          </span>
        </label>
        {task ? <input type="hidden" name="visibility_was" value={task.visibility} /> : null}

        <Field label="Checklist">
          <div className="flex flex-col gap-1.5">
            {checklist.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => update(index, { done: event.target.checked })}
                  aria-label={`Mark "${item.text || "this step"}" done`}
                  style={{ accentColor: "var(--accent)" }}
                />
                {/* The tick travels as a value, so an unticked box still posts
                    a row and the two arrays stay aligned on the server. */}
                <input type="hidden" name="checklist_done" value={item.done ? "1" : "0"} />
                {/* And who does it. A step can belong to somebody other than
                    the task's owner — that is how a task says it takes two
                    people — and without this every save handed all of them
                    back to the owner. Empty means the owner, which is also
                    what a row added here means until somebody says otherwise. */}
                <input
                  type="hidden"
                  name="checklist_owner"
                  value={item.ownerUserId ?? ""}
                />
                <input
                  name="checklist_text"
                  value={item.text}
                  onChange={(event) => update(index, { text: event.target.value })}
                  aria-label="Checklist item"
                  className="flex-1 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
                />
                {item.ownerName ? (
                  <span
                    className="shrink-0 whitespace-nowrap text-[11.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                    title={`${item.ownerName} does this step`}
                  >
                    {item.ownerName}
                  </span>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    setChecklist((rows) => rows.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove "${item.text || "this step"}"`}
                  className="px-1 text-[13px] leading-none"
                  style={{ color: "var(--text-disabled)" }}
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setChecklist((rows) => [...rows, { text: "", done: false }])}
              className="self-start py-1 text-[12.5px]"
              style={{ color: "var(--accent)" }}
            >
              + Add checklist item
            </button>
          </div>
        </Field>

        <div className="mt-1 flex items-center justify-between gap-4">
          {task ? (
            // WP.18b is a screen of its own in the export, so Remove opens it
            // rather than a browser confirm() — the words the design wrote are
            // more use than the ones the browser supplies.
            <Link
              href={`${closeHref}?task=${task.id}&remove=1`}
              scroll={false}
              className="text-[12.5px] no-underline"
              style={{ color: "var(--danger-text)" }}
            >
              Remove Task
            </Link>
          ) : (
            <span />
          )}

          <div className="flex gap-2.5">
            <Button unsized
              href={closeHref}
              variant="secondary"
              className="px-4 py-[9px] text-[13.5px]"
            >
              Cancel
            </Button>
            <Submit unsized
             
              variant="primary"
              className="px-[18px] py-[9px] text-[13.5px]"
            >
              Save
            </Submit>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** The plan's target, written the way the rest of the plan writes dates. */
function formatTarget(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
