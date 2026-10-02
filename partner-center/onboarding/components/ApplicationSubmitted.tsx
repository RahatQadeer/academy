import { Button } from "@/base/components/Button";
import { StatusCanvas } from "@/partner-center/onboarding/components/StatusScreen";

export function ApplicationSubmitted() {
  return (
    <StatusCanvas>
      <div className="flex flex-col items-center text-center">
        <span
          className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-full"
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
        <h1 className="mb-2 text-[20px] font-bold tracking-[-0.3px]">
          Application submitted
        </h1>
        <p
          className="mb-6 max-w-[320px] text-[13.5px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          We&apos;ll review your application and follow up within 2–3 business days.
          You can check your status anytime from this page.
        </p>
        <Button href="/partner-center/onboarding/pending" variant="secondary">
          Continue
        </Button>
      </div>
    </StatusCanvas>
  );
}
