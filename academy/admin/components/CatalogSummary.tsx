import type { CatalogProgram } from "./CatalogTable";

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "muted";
}) {
  const valueColor =
    tone === "success"
      ? "var(--success-fg)"
      : tone === "warning"
        ? "var(--warning-fg)"
        : tone === "muted"
          ? "var(--text-tertiary)"
          : "var(--ink)";

  return (
    <div className="min-w-0 bg-surface px-5 py-4">
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

export function CatalogSummary({ programs }: { programs: CatalogProgram[] }) {
  const published = programs.filter((p) => p.status === "published").length;
  const pending = programs.filter((p) => p.status === "pending_approval").length;
  const draft = programs.filter((p) => p.status === "draft").length;
  const enrollments = programs.reduce((sum, p) => sum + p.enrollmentCount, 0);

  return (
    <section
      aria-label="Catalog summary"
      className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] sm:grid-cols-5"
      style={{ border: "1px solid var(--border)", background: "var(--border)" }}
    >
      <Stat label="Total" value={programs.length} />
      <Stat label="Published" value={published} tone="success" />
      <Stat label="Pending" value={pending} tone="warning" />
      <Stat label="Draft" value={draft} tone="muted" />
      <Stat label="Enrollments" value={enrollments} />
    </section>
  );
}
