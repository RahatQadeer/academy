import { Pill } from "@/base/components/Pill";
import { NoticedRow, ShowRest, SHOWN } from "@/whitbyos/work-plans/[id]/components/NoticedSection";
import type { PlanRisk } from "@/whitbyos/lib/work-plans";

/**
 * §6.6 — what could go wrong, and what happens if it does.
 *
 * `whitbyos_risks` has existed since the schema was written and nothing wrote
 * to it until the drafter did, so this panel has had nothing to draw for as
 * long as the product has existed. A plan with no risks recorded shows nothing
 * rather than an empty box saying so: absence of a risk is not a finding.
 */
export function RisksPanel({
  risks,
  streamNames,
  basePath,
  all,
}: {
  risks: PlanRisk[];
  /** Work Stream id to name, so a risk says where it belongs. */
  streamNames: Map<string, string>;
  basePath: string;
  all: boolean;
}) {
  if (risks.length === 0) return null;

  const shown = all ? risks : risks.slice(0, SHOWN);

  return (
    <>
      {shown.map((risk) => (
        <NoticedRow key={risk.id}>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Pill tone="warning">{streamNames.get(risk.workstreamId) ?? "This plan"}</Pill>
              <span className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                {risk.risk}
              </span>
            </div>

          <Line label="If it happens" value={risk.impact} />
          <Line label="What reduces it" value={risk.mitigation} />
          <Line label="Instead" value={risk.backupPlan} />
          <Line label="What tells you" value={risk.trigger} />
        </NoticedRow>
      ))}

      <ShowRest
        hidden={all ? 0 : risks.length - shown.length}
        href={`${basePath}?noticed=risks&all=1`}
        noun="risk"
      />
    </>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="flex flex-wrap gap-x-2 text-[12.5px] leading-[1.55]">
      <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {label}:
      </span>
      <span style={{ color: "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}
