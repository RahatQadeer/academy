import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Pill } from "@/base/components/Pill";
import { Modal } from "@/whitbyos/components/Modal";
import { reassignTask, completeTask, setTaskStatus } from "@/whitbyos/tasks/actions";
import {
  TASK_STATUS,
  isDone,
  priorityLabel,
  priorityTone,
  taskStatusLabel,
  taskStatusTone,
} from "@/whitbyos/lib/task-vocab";
import type { TaskDetail } from "@/whitbyos/lib/tasks";
import { AssigneePicker } from "@/whitbyos/tasks/components/AssigneePicker";
import type { Assignee } from "@/whitbyos/lib/work-plans";

const VISIBILITY: Record<string, string> = {
  internal: "Internal only",
  client_account: "Client account",
  selected_people: "Selected people",
  private: "Private to requestor",
};

/**
 * Screen 7.1 — Task Detail.
 *
 * Reads rather than edits, which is what the reference draws: the eight fields
 * SRS §6.7.1 names, laid out two to a row, with the two things you actually do
 * from here at the bottom. Status is the exception — it is a select, because a
 * task whose state can only be changed by finishing it would make "In progress"
 * and "Waiting" unreachable.
 */
export function TaskDetailDialog({
  task,
  assignees,
  reassigning,
  closeHref,
}: {
  task: TaskDetail;
  assignees: Assignee[];
  reassigning?: boolean;
  closeHref: string;
}) {
  const done = isDone(task.status);
  const priority = priorityLabel(task.priority);
  const trail = [task.request_title, task.workstream_name].filter(Boolean).join(" / ");

  return (
    <Modal
      title={task.title}
      eyebrow={trail || "Unlinked task"}
      closeHref={closeHref}
      width={560}
      dense
    >
      <div className="mb-[18px] grid grid-cols-2 gap-x-5 gap-y-3.5">
        {/* 16a says "Assignees" and writes them all out — "Jordan Hartwell,
            Tom Chen", so reassigning has to be able to set more than one, or
            saving here would quietly drop whoever else was on it. */}
        <Detail label="Assignees">
          {reassigning ? (
            <form action={reassignTask} className="col-span-2 flex flex-col gap-2">
              <input type="hidden" name="task_id" value={task.id} />
              <AssigneePicker people={assignees} initial={task.assigneeIds} label="" />
              <SubmitPlain
               
                className="w-fit cursor-pointer text-[12.5px]"
                style={{ color: "var(--accent)" }}
              >
                Save
              </SubmitPlain>
            </form>
          ) : (
            task.ownerName
          )}
        </Detail>

        <Detail label="Priority">
          {priority ? <Pill tone={priorityTone(task.priority)}>{priority}</Pill> : "Not set"}
        </Detail>

        <Detail label="Due">
          <DueLine due={task.due_date} status={task.status} />
        </Detail>

        <Detail label="Status">
          {/* A select rather than a pill: 7.1 is the only place a task's state
              can be set, and Mark Complete alone cannot reach In progress or
              Waiting. It still reads as the reference's pill until touched. */}
          <form action={setTaskStatus} className="flex items-center gap-2">
            <input type="hidden" name="task_id" value={task.id} />
            <Pill tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Pill>
            <select
              name="status"
              defaultValue={done ? "complete" : task.status}
              aria-label="Change status"
              className="min-w-0 rounded-control border border-line-strong bg-surface px-1.5 py-0.5 text-[12px]"
            >
              {TASK_STATUS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SubmitPlain className="text-[12px]" style={{ color: "var(--accent)" }}>
              Set
            </SubmitPlain>
          </form>
        </Detail>

        <Detail label="Dependency">{task.dependency ?? "None"}</Detail>
        <Detail label="Visibility">{VISIBILITY[task.visibility] ?? task.visibility}</Detail>
      </div>

      <Block label="Next Action" value={task.next_action} fallback="Not set" />
      <Block
        label="Completion Evidence"
        value={task.completion_evidence}
        fallback="Not yet provided"
        last
      />

      <div className="flex justify-end gap-2.5">
        <form action={completeTask} className="flex gap-2.5">
          <input type="hidden" name="task_id" value={task.id} />
          <Button unsized
            href={`${closeHref}?task=${task.id}&reassign=1`}
            variant="secondary"
            className="px-4 py-[9px] text-[13.5px]"
          >
            Reassign
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            {done ? "Reopen Task" : "Mark Complete"}
          </Submit>
        </form>
      </div>
    </Modal>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-[5px] text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </div>
      <div className="text-[13.5px]">{children}</div>
    </div>
  );
}

function Block({
  label,
  value,
  fallback,
  last,
}: {
  label: string;
  value: string | null;
  fallback: string;
  last?: boolean;
}) {
  return (
    <div className={last ? "mb-[22px]" : "mb-[18px]"}>
      <div className="mb-[5px] text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </div>
      <div
        className="text-[13.5px] leading-[1.5]"
        style={value ? undefined : { color: "var(--text-disabled)" }}
      >
        {value || fallback}
      </div>
    </div>
  );
}

/** 7.1 writes the due date out in full, and says so when it has passed. */
function DueLine({ due, status }: { due: string | null; status: string }) {
  if (!due) return <>No due date</>;

  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return <>No due date</>;

  const text = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const overdue = !isDone(status) && date.getTime() < Date.now();

  return overdue ? (
    <span className="font-medium" style={{ color: "var(--danger-fg)" }}>
      {text}, Overdue
    </span>
  ) : (
    <>{text}</>
  );
}
