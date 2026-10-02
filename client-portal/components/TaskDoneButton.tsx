import { setTaskDone } from "@/client-portal/lib/actions/tasks";
import { SubmitButton } from "./SubmitButton";
import { TaskTick } from "./TaskTick";

/**
 * The client's own tick on a task, and the same control undoing it.
 *
 * A task the firm shares with the client is often a task *for* the client —
 * "send the signed lease", "confirm the dates" — and until
 * `client-portal/migrations/020` only the professional could close one. So the
 * client did the thing and then had to tell somebody so that somebody could
 * tick it, which is two people's work for one box.
 *
 * One form, one hidden boolean. The label says what pressing it will do, not
 * what the task is, so the row reads the same whichever state it is in.
 *
 * `returnTo` is the screen this row is on, tab and search included: the action
 * redirects back to it with a toast, and a Request's Tasks tab must not become
 * the Tasks screen because somebody ticked something.
 */
export function TaskDoneButton({
  taskId,
  done,
  returnTo,
  requestId,
}: {
  taskId: string;
  /** The task's state now — the button offers the other one. */
  done: boolean;
  returnTo: string;
  /**
   * The Request whose shared Work Plan put this task on screen, when that is
   * how it got there — `setTaskDone` looks a plan task up on it.
   */
  requestId?: string;
}) {
  return (
    <form action={setTaskDone}>
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <input type="hidden" name="return_to" value={returnTo} />
      {requestId ? <input type="hidden" name="request_id" value={requestId} /> : null}
      <SubmitButton
        size="row"
        variant={done ? "ghost" : "secondary"}
        pendingLabel="Saving…"
      >
        {done ? "Mark not complete" : "Mark complete"}
      </SubmitButton>
    </form>
  );
}

/**
 * The same write, as the checkbox a task row already draws.
 *
 * Used where the row has no space for a button and already has a box —
 * a Request's Overview card. Same three hidden fields, same action.
 */
export function TaskTickForm({
  taskId,
  done,
  returnTo,
  requestId,
}: {
  taskId: string;
  done: boolean;
  returnTo: string;
  requestId?: string;
}) {
  return (
    <form action={setTaskDone} className="flex shrink-0">
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="done" value={done ? "0" : "1"} />
      <input type="hidden" name="return_to" value={returnTo} />
      {requestId ? <input type="hidden" name="request_id" value={requestId} /> : null}
      <TaskTick done={done} label={done ? "Mark not complete" : "Mark complete"} />
    </form>
  );
}
