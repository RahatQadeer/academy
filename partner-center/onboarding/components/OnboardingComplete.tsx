import { ActivatePartnerButton } from "@/partner-center/onboarding/components/ActivatePartnerButton";

export function OnboardingComplete({
  companyName,
  programSummary,
}: {
  companyName: string;
  programSummary: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: "var(--ink)" }}
    >
      <div className="max-w-[480px] text-center">
        <p
          className="text-[11.5px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Partner Center
        </p>
        <h1 className="mt-3 text-[24px] font-bold tracking-[-0.5px] text-white text-pretty">
          You&apos;re ready to start referring
        </h1>
        <p
          className="mt-3 text-[14px] leading-[1.55]"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          {companyName} is active on {programSummary}. Finish your tax and payout
          setup anytime from Home.
        </p>
        <div className="mt-8 flex justify-center">
          <ActivatePartnerButton
            label="Go to Partner Center"
            variant="primary"
            skipped
          />
        </div>
      </div>
    </div>
  );
}
