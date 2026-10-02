import { isDone } from "@/whitbyos/lib/task-vocab";
import type { TaskRow } from "@/whitbyos/lib/tasks";

/**
 * Screen 7's left rail — eight ways of asking the same list a question.
 *
 * The reference draws them as one column with a count against each, and the
 * counts are the point: they are how somebody decides what to open. So every
 * one is computed from the rows actually loaded rather than stored, which is
 * the same reason Work Plans counts its progress rather than keeping a
 * counter — two versions of one fact drift the first time anything moves.
 *
 * The first three divide the workspace's open work by who holds it — though a
 * task with two people on it is honestly in both My Tasks and Team Tasks, and
 * the next five ask about state, so they freely overlap too. That is how
 * the reference reads too — "My Tasks 6 · Team Tasks 18 · General 3" against
 * "Due Today 2 · Upcoming 9 · Waiting 4 · Overdue 1 · Completed 31", where the
 * second row adds up to far more than the first.
 */

export type TaskScope =
  | "all"
  | "mine"
  | "team"
  | "general"
  | "today"
  | "upcoming"
  | "waiting"
  | "overdue"
  | "completed";

export const TASK_SCOPES: Array<{ value: TaskScope; label: string; group: 1 | 2 }> = [
  /* Everything open, whoever is holding it. The three below divide the work
     by who has it, and there was no way back to the undivided list. */
  { value: "all", label: "All tasks", group: 1 },
  { value: "mine", label: "My Tasks", group: 1 },
  { value: "team", label: "Team Tasks", group: 1 },
  { value: "general", label: "General", group: 1 },
  { value: "today", label: "Due Today", group: 2 },
  { value: "upcoming", label: "Upcoming", group: 2 },
  { value: "waiting", label: "Waiting", group: 2 },
  { value: "overdue", label: "Overdue", group: 2 },
  { value: "completed", label: "Completed", group: 2 },
];

export function isTaskScope(value: string | undefined): value is TaskScope {
  return TASK_SCOPES.some((scope) => scope.value === value);
}

/** Midnight today, in the same shape a due_date is stored in. */
function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function dueDay(task: TaskRow) {
  if (!task.due_date) return null;
  const due = new Date(task.due_date);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  return due.getTime();
}

export function matchesScope(task: TaskRow, scope: TaskScope, meId: string | null) {
  const done = isDone(task.status);
  const day = dueDay(task);
  const today = startOfToday();

  switch (scope) {
    // Everything that is still work. Completed has its own answer below.
    case "all":
      return !done;
    // A task with several people on it is mine if I am one of them, and the
    // team's if anybody else is — so a shared task appears in both, which is
    // the truth about it.
    case "mine":
      return !done && Boolean(meId) && task.assignees.some((who) => who.userId === meId);
    case "team":
      return !done && task.assignees.some((who) => who.userId !== meId);
    // Not "everything else" — a task with nobody's name on it. The reference
    // sets General beside My and Team, and the thing those two do not cover is
    // work that has not been given to anybody.
    case "general":
      return !done && task.assignees.length === 0;
    case "today":
      return !done && day === today;
    case "upcoming":
      return !done && day !== null && day > today;
    case "waiting":
      return !done && task.status.toLowerCase() === "waiting";
    case "overdue":
      return !done && day !== null && day < today;
    case "completed":
      return done;
  }
}

export function scopeCounts(rows: TaskRow[], meId: string | null) {
  const counts = {} as Record<TaskScope, number>;
  for (const scope of TASK_SCOPES) {
    counts[scope.value] = rows.filter((row) => matchesScope(row, scope.value, meId)).length;
  }
  return counts;
}
