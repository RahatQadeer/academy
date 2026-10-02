import { Button } from "@/base/components/Button";
import {
  AGREEMENT_VERSION,
  PARTNER_PATHS,
  formatSignedDate,
} from "@/partner-center/lib/review-state";
import { StatusCanvas } from "@/partner-center/onboarding/components/StatusScreen";

export function AgreementSigned({ signedAt }: { signedAt?: string }) {
  const signed = formatSignedDate(signedAt);

  return (
    <StatusCanvas>
      <div className="flex flex-col items-center text-center">
        <span
          className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3.5 9.4L7 12.9L14.5 5.4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mb-2 text-[20px] font-bold tracking-[-0.35px]">
          You&apos;re all set — welcome aboard
        </h1>
        <p
          className="mb-3 max-w-[340px] text-[13.5px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          Your Partner Agreement has been signed and your Partner Center account is
          being finalized.
        </p>
        <p
          className="mb-6 text-[12.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {signed ? `Signed ${signed}` : "Signed"} · Agreement v{AGREEMENT_VERSION}
        </p>
        <Button href={PARTNER_PATHS.checklist} variant="primary" fullWidth>
          Continue to onboarding checklist
        </Button>
      </div>
    </StatusCanvas>
  );
}
