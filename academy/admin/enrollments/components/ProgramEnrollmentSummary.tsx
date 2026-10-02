import type { ProgramEnrollmentListItem } from "../types";

type Summary = {
  total: number;
  enrolled: number;
  inProgress: number;
  completed: number;
};

export function summarizeProgramEnrollments(items: ProgramEnrollmentListItem[]): Summary {
  let enrolled = 0;
  let inProgress = 0;
  let completed = 0;
  for (const item of items) {
    if (item.status === "completed") completed += 1;
    else if (item.status === "in_progress") inProgress += 1;
    else enrolled += 1;
  }
  return { total: items.length, enrolled, inProgress, completed };
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "info" | "success";
}) {
  const valueColor =
    tone === "success"
      ? "var(--success-fg)"
      : tone === "info"
        ? "var(--accent)"
        : "var(--ink)";

  return (
    <div className="min-w-0">
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 text-[26px] font-semibold tabular-nums tracking-[-0.5px] leading-none"
        style={{ color: valueColor }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export function ProgramEnrollmentSummary({ items }: { items: ProgramEnrollmentListItem[] }) {
  const summary = summarizeProgramEnrollments(items);

  return (
    <section
      aria-label="Enrollment summary"
      className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] sm:grid-cols-4"
      style={{
        border: "1px solid var(--border)",
        background: "var(--border)",
      }}
    >
      <div className="bg-surface px-5 py-4">
        <Stat label="Total" value={summary.total} />
      </div>
      <div className="bg-surface px-5 py-4">
        <Stat label="Not started" value={summary.enrolled} />
      </div>
      <div className="bg-surface px-5 py-4">
        <Stat label="In progress" value={summary.inProgress} tone="info" />
      </div>
      <div className="bg-surface px-5 py-4">
        <Stat label="Completed" value={summary.completed} tone="success" />
      </div>
    </section>
  );
}
