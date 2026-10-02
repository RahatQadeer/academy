import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { createTask } from "@/whitbyos/tasks/actions";
import { TASK_PRIORITY } from "@/whitbyos/lib/task-vocab";
import { AssigneePicker } from "@/whitbyos/tasks/components/AssigneePicker";
import type { Assignee } from "@/whitbyos/lib/work-plans";
import type { PlanStreams } from "@/whitbyos/lib/tasks";
import { TaskPlacement, type RequestOption } from "@/whitbyos/tasks/components/TaskPlacement";
import { SubmitWhenReady } from "@/whitbyos/tasks/components/SubmitWhenReady";

/**
 * Screen 7.0 — New Task.
 *
 * The Work Stream is required, and it did not used to be. §6.7.1 lets a Task
 * stand on its own, and standing on its own is what 87 of this workspace's
 * tasks do: no stream, no steps, and nothing to work through when one is
 * opened. Tasks now lists the work of the plans being worked on, so a task
 * with no plan is a task made on a screen it would not appear on.
 *
 * Whitby writes the steps for whatever is added here, the same way it writes
 * them for every task it drafts into a plan. A task without them is a title
 * and a date.
 */
export function NewTaskDialog({
  requests,
  clients,
  streams,
  assignees,
  currentUserId,
  openClientId,
  openRequestId,
  closeHref,
  error,
}: {
  requests: RequestOption[];
  clients: { id: string; name: string }[];
  /** The plans being worked on, each with its own Work Streams under it. */
  streams: PlanStreams[];
  assignees: Assignee[];
  currentUserId?: string;
  /** The client workspace that is open, which the form starts on. */
  openClientId?: string | null;
  /** The Request this was opened from, which the form starts on. */
  openRequestId?: string | null;
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="New Task" closeHref={closeHref} width={560} dense>
      <form action={createTask} className="flex flex-col">
        {error ? (
          <div className="mb-4">
            <Callout tone="danger">{error}</Callout>
          </div>
        ) : null}

        <TaskField label="Title" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            placeholder="Enter the title"
            className={CONTROL}
          />
        </TaskField>

        {/*
         * Client, plan, stream and request together, because each one narrows
         * the next. Four independent selects over everything in the workspace
         * would offer one client's name above another's Work Plan and a
         * third's Request, and did.
         */}
        <TaskPlacement
          clients={clients}
          plans={streams}
          requests={requests}
          openClientId={openClientId}
          openRequestId={openRequestId}
        />

        <div className="mb-4">
          <AssigneePicker
            people={assignees}
            initial={currentUserId ? [currentUserId] : []}
            currentUserId={currentUserId}
          />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3.5">
          <TaskField label="Priority" htmlFor="priority" flush>
            <select id="priority" name="priority" defaultValue="medium" className={CONTROL}>
              {TASK_PRIORITY.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </TaskField>

          <TaskField label="Due date" htmlFor="due_date" flush>
            {/* Required, like everything here that is not marked optional: a
                task with no date is one nothing can be late for. */}
            <input id="due_date" name="due_date" type="date" required className={CONTROL} />
          </TaskField>
        </div>

        <div className="mb-5">
          <TaskField label="Next Action (optional)" htmlFor="next_action" flush>
            <textarea
              id="next_action"
              name="next_action"
              placeholder="What's the immediate next step?"
              className={`${CONTROL} min-h-[56px] resize-none`}
            />
          </TaskField>
        </div>

        {/* SRS 7.1.5 — a Task is internal unless somebody says otherwise.
            The dialog used to say nothing, and the action wrote "internal"
            with no way to ask for anything else, so a task added here could
            never reach the person it was for: the portal reads
            `visibility = 'client_visible'` and nothing on this screen could
            ever write it. WP.18's Edit Task has carried this checkbox all
            along, which is why a task inside a Work Plan could be shared and
            a task added here could not. */}
        <label
          className="mb-5 flex items-start gap-2 text-[13px]"
          style={{ color: "var(--ink)" }}
        >
          <input
            type="checkbox"
            name="client_visible"
            value="1"
            className="mt-[3px]"
            style={{ accentColor: "var(--accent)" }}
          />
          <span>
            Visible to the client
            <span
              className="block text-[11.5px] leading-[1.4]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Shows in their portal, on the Request where it has one, and on
              their Tasks screen where it does not.
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <SubmitWhenReady>Create Task</SubmitWhenReady>
        </div>
      </form>
    </Modal>
  );
}

/**
 * The Tasks dialogs label their fields a shade smaller and tighter than the
 * Work Plans ones — 12px at 60% rather than 12.5px at 50% — so they use their
 * own field rather than bending the shared one to two sets of numbers.
 */
export const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink placeholder:text-[rgba(55,53,47,0.35)]";

export function TaskField({
  label,
  htmlFor,
  children,
  flush,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className={flush ? "" : "mb-4"}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
