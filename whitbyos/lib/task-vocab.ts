/**
 * The words the Tasks screens use, kept apart from `lib/tasks.ts` because that
 * module reaches for the server-side Supabase client and the dialogs are client
 * components — importing a value from it would pull `next/headers` into the
 * browser bundle.
 */

/** Screen 7's Status column, and 7.0's default. */
export const TASK_STATUS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting" },
  { value: "complete", label: "Complete" },
] as const;

/** 7.0's Priority select, in the order the reference lists it. */
export const TASK_PRIORITY = [
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
] as const;

export const DONE_STATUSES = new Set(["complete", "completed", "done"]);

export function isDone(status: string) {
  return DONE_STATUSES.has(status.toLowerCase());
}

/**
 * `open` is the column default in base's schema and predates these four words,
 * so rows carrying it read as "Not started" rather than as an unknown state.
 */
export function taskStatusLabel(status: string) {
  const key = status?.toLowerCase() ?? "";
  if (key === "open" || !key) return "Not started";
  return TASK_STATUS.find((option) => option.value === key)?.label ?? status;
}

/** Maps the column default and any legacy value onto the four the screens use. */
export function normaliseStatus(status: string) {
  const key = status?.toLowerCase() ?? "";
  if (isDone(key)) return "complete";
  if (key === "open" || !key) return "not_started";
  return TASK_STATUS.some((o) => o.value === key) ? key : "not_started";
}

export function taskStatusTone(status: string) {
  const key = status?.toLowerCase() ?? "";
  if (isDone(key)) return "success" as const;
  if (key === "waiting") return "warning" as const;
  if (key === "in_progress") return "info" as const;
  return "neutral" as const;
}

export function priorityLabel(priority: string | null) {
  if (!priority) return null;
  return (
    TASK_PRIORITY.find((option) => option.value === priority.toLowerCase())?.label ??
    priority
  );
}

export function priorityTone(priority: string | null) {
  switch ((priority ?? "").toLowerCase()) {
    case "high":
    case "urgent":
    case "critical":
      return "danger" as const;
    case "medium":
    case "standard":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

/**
 * Screen 7's Due column, which is three different things: "Overdue" in the
 * danger colour, "Today" in ink, or a plain short date. A finished task is
 * never overdue, however late it was.
 */
export function dueLabel(
  due: string | null,
  status: string,
  now = new Date(),
): { text: string; tone: "danger" | "ink" | "muted" } | null {
  if (!due) return null;

  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return null;

  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  // In days. `day()` answers in milliseconds, which only ever had to be right
  // about its sign while this said "Overdue" and nothing else; the moment it
  // had to count, it read a day late as 86,400,000 of them.
  const diff = Math.round((day(date) - day(now)) / 86_400_000);

  /*
   * How late, not just that it is late.
   *
   * Thirteen rows all saying "Overdue" in red say one thing thirteen times and
   * nothing about which to pick up first. A day over and a month over are
   * different problems, and the number is already here.
   */
  if (diff < 0 && !isDone(status)) {
    const late = -diff;
    return {
      text:
        late === 1
          ? "1 day late"
          : late < 14
            ? `${late} days late`
            : late < 60
              ? `${Math.round(late / 7)} weeks late`
              : `${Math.round(late / 30)} months late`,
      tone: "danger",
    };
  }

  if (diff === 0) return { text: "Today", tone: "ink" };
  if (diff === 1) return { text: "Tomorrow", tone: "ink" };

  return {
    text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    tone: "muted",
  };
}
