import { Pill } from "@/base/components/Pill";
import { shortDate } from "@/whitbyos/lib/format";
import type { PlanFeasibility } from "@/whitbyos/lib/work-plans";

/**
 * Whether the plan can reach its date, and what is in the way if it cannot.
 *
 * The scheduler works this out once, when the plan is written, and it is kept
 * rather than recomputed — the dates on the tasks were decided by this answer,
 * and working it out again from rows somebody has since edited would warn about
 * a plan that no longer exists.
 *
 * A plan that fits says so in one quiet line. Nobody needs a banner to be told
 * their deadline is fine, but they do need to know the question was asked.
 */
export function FeasibilityBanner({
  feasibility,
  targetDate,
}: {
  feasibility: PlanFeasibility | null;
  /**
   * The date on the plan, which is not always the date the scheduler used.
   *
   * A deadline on a Saturday is not a deadline anybody works to, so the
   * scheduler plans backwards from the last working day before it. It then
   * reported that adjusted day as `targetDate`, and the banner printed it
   * as "It is due Oct 9" under a header saying "Due Oct 10" — two dates,
   * one screen, no explanation. Both are true; only one was asked for.
   */
  targetDate: string | null;
}) {
  if (!feasibility) return null;

  /* Only worth saying where they differ, which is a weekend or a holiday. */
  const movedBack = Boolean(targetDate && targetDate !== feasibility.targetDate);

  if (feasibility.fits) {
    return (
      <div
        className="flex flex-wrap items-center gap-2 text-[12.5px]"
        style={{ color: "var(--text-secondary)" }}
      >
        <Pill tone="success">On track</Pill>
        <span>
          {feasibility.criticalPathDays} working day
          {feasibility.criticalPathDays === 1 ? "" : "s"} of work on the longest
          chain, due {shortDate(targetDate ?? feasibility.targetDate)}
          {movedBack
            ? `, worked back from ${shortDate(feasibility.targetDate)}, the last working day before it`
            : ""}
          .
        </span>
      </div>
    );
  }

  return (
    <div
      className="rounded-card border p-4"
      style={{ borderColor: "var(--danger-border, var(--border-strong))", background: "var(--danger-bg)" }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Pill tone="danger">Deadline at risk</Pill>
        <span className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>
          {feasibility.shortfallDays} working day
          {feasibility.shortfallDays === 1 ? "" : "s"} short
        </span>
      </div>

      {/*
        * Folded, because the headline is the whole answer most days.
        *
        * "One working day short" is what somebody opening a plan needs; the
        * three lists under it are what they need once they have decided to
        * do something about it, and they were pushing the plan itself below
        * the fold on every visit in between.
        *
        * A `details` rather than state, so it needs no script and a printed
        * page carries it.
        */}
      <details className="group">
        <summary
          className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] leading-[1.55] [&::-webkit-details-marker]:hidden"
          style={{ color: "var(--text-secondary)" }}
        >
          <span
            aria-hidden
            className="text-[10px] transition-transform group-open:rotate-90"
            style={{ color: "var(--text-tertiary)" }}
          >
            ▸
          </span>
          <span>
            Earliest finish{" "}
            <strong style={{ color: "var(--ink)" }}>
              {shortDate(feasibility.earliestFinish)}
            </strong>
            , due{" "}
            <strong style={{ color: "var(--ink)" }}>
              {shortDate(targetDate ?? feasibility.targetDate)}
            </strong>
            . What is causing it
          </span>
        </summary>

        <p
          className="text-[13px] leading-[1.55]"
          style={{ margin: "10px 0 12px", color: "var(--text-secondary)" }}
        >
          Starting today, the earliest this can finish is{" "}
          <strong style={{ color: "var(--ink)" }}>{shortDate(feasibility.earliestFinish)}</strong>.
          It is due <strong style={{ color: "var(--ink)" }}>{shortDate(targetDate ?? feasibility.targetDate)}</strong>
          {movedBack ? (
            <>
              , which falls on a weekend, so the work is planned to{" "}
              {shortDate(feasibility.targetDate)}, the last working day before it
            </>
          ) : null}
          . The dates below are the soonest the work can be done, not the dates
          it was asked for.
        </p>

        <Detail label="What is causing it" items={feasibility.criticalPath} />
        <Detail label="What blocks the most" items={feasibility.blocking} />
        <Detail label="What can run alongside" items={feasibility.parallelisable} />
      </details>
    </div>
  );
}

/**
 * One line of the explanation.
 *
 * Names rather than counts, because "three tasks" is not something anybody can
 * act on and "Obtain police certificate" is. Long lists are cut at five: past
 * that it stops being a list of what to look at.
 */
function Detail({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;

  const shown = items.slice(0, 5);
  const rest = items.length - shown.length;

  return (
    <div className="mb-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[12.5px] last:mb-0">
      <span style={{ color: "var(--text-tertiary)" }}>{label}:</span>
      <span style={{ color: "var(--ink)" }}>
        {shown.join(" → ")}
        {rest > 0 ? ` and ${rest} more` : ""}
      </span>
    </div>
  );
}
