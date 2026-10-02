import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { formatProgramList, PARTNER_PATHS } from "@/partner-center/lib/review-state";
import { StatusCanvas } from "@/partner-center/onboarding/components/StatusScreen";

export function ApplicationApproved({
  companyName,
  programs,
}: {
  companyName: string | null;
  programs: string[];
}) {
  const who = companyName || "your firm";
  return (
    <StatusCanvas>
      <div className="text-center">
        <Pill tone="success">Approved</Pill>
        <h1 className="mb-3 mt-3 text-[20px] font-bold tracking-[-0.35px]">
          You&apos;re approved — let&apos;s finalize your agreement
        </h1>
        <p
          className="mb-6 text-[13.5px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          Congratulations! {who} has been approved for the {formatProgramList(programs)}{" "}
          referral programs. One step remains before your Partner Center is active.
        </p>
        <Button href={PARTNER_PATHS.agreement} variant="primary" fullWidth>
          Review &amp; sign agreement
        </Button>
      </div>
    </StatusCanvas>
  );
}
