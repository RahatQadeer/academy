import { Building2 } from "lucide-react";
import { Button } from "@/base/components/Button";

export function OpportunitiesEmptyState({
  canSubmit = true,
}: {
  canSubmit?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="max-w-[420px] text-center">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[10px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          aria-hidden
        >
          <Building2 size={22} strokeWidth={2.25} />
        </div>
        <h2
          className="m-0 mb-2 text-[18px] font-semibold tracking-[-0.2px]"
          style={{ color: "var(--ink)" }}
        >
          No opportunities yet
        </h2>
        <p
          className="m-0 mb-6 text-[14px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          {canSubmit
            ? "Register a company-level deal. Once it is accepted, you get a protected window to earn commission on it."
            : "Your access is read-only. Opportunities submitted by your team will appear here."}
        </p>
        {canSubmit ? (
          <div className="flex justify-center">
            <Button href="/partner-center/opportunities/new">
              Submit an opportunity
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
