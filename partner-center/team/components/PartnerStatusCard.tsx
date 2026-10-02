import { Pill } from "@/base/components/Pill";
import { statusLabel } from "@/partner-center/team/lib/labels";
import type { TeamPageData } from "@/partner-center/team/types";

function statusTone(status: string | null): "success" | "neutral" | "warning" | "danger" {
  if (status === "active") return "success";
  if (status === "approved") return "success";
  if (status === "declined") return "danger";
  if (status === "under_review" || status === "applied") return "warning";
  return "neutral";
}

export function PartnerStatusCard({ data }: { data: TeamPageData }) {
  return (
    <section>
      <h2
        className="mb-2.5 mt-0 text-[14px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        Partner status
      </h2>
      <div className="pa-partner-card p-5">
        <div className="space-y-4">
          <div>
            <div
              className="text-[12.5px] font-medium uppercase tracking-[0.04em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Status
            </div>
            <div className="mt-1.5">
              <Pill tone={statusTone(data.status)}>{statusLabel(data.status)}</Pill>
            </div>
          </div>
          <div>
            <div
              className="text-[12.5px] font-medium uppercase tracking-[0.04em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Programs
            </div>
            <div className="mt-1 text-[14px]" style={{ color: "var(--ink)" }}>
              {data.programs.length ? data.programs.join(", ") : "—"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
