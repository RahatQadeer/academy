import { longDate } from "@/client-portal/lib/format";
import { Card } from "@/client-portal/components/Surface";

/**
 * The closing Work Summary on a completed Request (SRS 6.16.2).
 *
 * Deliberately not a Progress Update. SRS 6.15.2 is explicit that the two must
 * stay separate — an update says where things stand mid-flight, a Work Summary
 * is the closing record — so this renders as its own section above the update
 * feed rather than as another entry inside it.
 *
 * Renders nothing when there is no summary to show, which is every open request
 * and every closed one whose summary has not been approved for sharing. The
 * decision about *whether* a summary is shareable belongs to
 * `WORK_SUMMARY_IS_SHAREABLE` in `lib/data/requests.ts`, not here.
 */
export function WorkSummary({
  summary,
  closedAt,
  timeZone = "UTC",
}: {
  summary: string | null;
  closedAt: string | null;
  /** The professional's zone — see `PortalContext.timezone`. */
  timeZone?: string;
}) {
  if (!summary) return null;

  return (
    <section className="mb-6">
      <h2
        className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Work Summary
      </h2>
      <Card>
        {closedAt ? (
          <div
            className="mb-2 text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Closed {longDate(closedAt, timeZone)}
          </div>
        ) : null}
        {summary.split(/\n{2,}/).map((paragraph, index) => (
          <p
            key={index}
            className="max-w-[72ch] text-[14px] leading-[1.6] [&+&]:mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            {paragraph}
          </p>
        ))}
      </Card>
    </section>
  );
}
