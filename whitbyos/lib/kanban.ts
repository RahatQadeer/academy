import type { PlanTask } from "@/whitbyos/lib/work-plans";
import { PLAN_INK, streamInk } from "@/whitbyos/lib/plan-ink";

/**
 * WP.17d's lanes, and the two controls above them.
 *
 * Grouping and sorting are decisions about the same set of cards, so they are
 * worked out here rather than inside the markup — the board then only has to
 * draw whatever it is handed.
 */

const DONE = new Set(["complete", "completed", "done"]);

export type KanbanCard = PlanTask & { streamName: string; streamId: string };

export type KanbanGroup = "status" | "stream" | "owner";
export type KanbanSort = "manual" | "due" | "priority" | "title";

export const KANBAN_GROUPS: Array<{ value: KanbanGroup; label: string }> = [
  { value: "status", label: "Status" },
  { value: "stream", label: "Work Stream" },
  { value: "owner", label: "Owner" },
];

export const KANBAN_SORTS: Array<{ value: KanbanSort; label: string }> = [
  // The order somebody dragged them into — 091, and the board's default,
  // because a board you can rearrange that re-sorts itself is not one.
  { value: "manual", label: "Your order" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "title", label: "Task" },
];

export type KanbanLane = {
  /** On an owner column, whose it is, so a card dropped in it is handed over. */
  ownerUserId?: string | null;
  key: string;
  label: string;
  ink: string;
  tasks: KanbanCard[];
  /** Where the lane's "+" goes, when adding into it means something. */
  addHref?: string;
};

/** Which of the four status lanes a task belongs in. */
export function laneOf(status: string) {
  const key = status.toLowerCase();
  if (DONE.has(key)) return "complete";
  if (key === "in_progress" || key === "running") return "in_progress";
  if (key === "waiting" || key === "blocked") return "waiting";
  return "not_started";
}

const STATUS_LANES = [
  { key: "not_started", label: "Not Started", ink: PLAN_INK.planned },
  { key: "in_progress", label: "Running", ink: PLAN_INK.running },
  { key: "waiting", label: "Waiting", ink: PLAN_INK.waiting },
  { key: "complete", label: "Complete", ink: PLAN_INK.complete },
];

/** The colours a Work Stream lane cycles through, in the order streams appear. */
// Was five colours of its own; now the plan's, so a stream is the same hue
// here as it is in the Table and on the List.

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function kanbanLanes(
  tasks: KanbanCard[],
  group: KanbanGroup,
  sort: KanbanSort,
): KanbanLane[] {
  const ordered = [...tasks].sort(compare(sort));

  if (group === "stream") {
    const seen: KanbanLane[] = [];
    for (const task of ordered) {
      let lane = seen.find((row) => row.key === task.streamId);
      if (!lane) {
        lane = {
          key: task.streamId,
          label: task.streamName,
          ink: streamInk(seen.length),
          tasks: [],
        };
        seen.push(lane);
      }
      lane.tasks.push(task);
    }
    return seen;
  }

  if (group === "owner") {
    const seen: KanbanLane[] = [];
    for (const task of ordered) {
      const key = task.ownerInitials ?? "??";
      let lane = seen.find((row) => row.key === key);
      if (!lane) {
        lane = {
          key,
          ownerUserId: task.ownerUserId ?? null,
          label: task.ownerName ?? "Unassigned",
          ink: streamInk(seen.length),
          tasks: [],
        };
        seen.push(lane);
      }
      lane.tasks.push(task);
    }
    return seen;
  }

  return STATUS_LANES.map((lane) => ({
    ...lane,
    tasks: ordered.filter((task) => laneOf(task.status) === lane.key),
  }));
}

/**
 * The sort, with one rule shared by all three: a task with nothing to sort on
 * goes last. A blank due date sorting first would put the least decided work at
 * the top of every lane.
 */
function compare(sort: KanbanSort) {
  return (a: KanbanCard, b: KanbanCard) => {
    // Whatever order they arrived in, which is the plan's own: `sort_order`
    // first, then the order they were drafted in.
    if (sort === "manual") return 0;

    if (sort === "title") return a.title.localeCompare(b.title);

    if (sort === "priority") {
      const rank = (task: KanbanCard) =>
        PRIORITY_ORDER[String(task.priority ?? "").toLowerCase()] ?? 3;
      const diff = rank(a) - rank(b);
      return diff !== 0 ? diff : a.title.localeCompare(b.title);
    }

    if (!a.due_date && !b.due_date) return a.title.localeCompare(b.title);
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  };
}
