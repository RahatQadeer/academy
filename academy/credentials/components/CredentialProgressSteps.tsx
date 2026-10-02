import Link from "next/link";
import type { CredentialStep } from "../types/detail";

function StepIcon({ state }: { state: CredentialStep["state"] }) {
  if (state === "complete") {
    return (
      <span
        className="mt-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
        aria-hidden
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2L4.8 8.5L9.5 3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="mt-0.5 inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: state === "current" ? "transparent" : "var(--surface-soft)",
        border:
          state === "current" ? "2px solid var(--accent)" : "1px solid var(--border-strong)",
      }}
      aria-hidden
    />
  );
}

export function CredentialProgressSteps({ steps }: { steps: CredentialStep[] }) {
  return (
    <section className="rounded-[10px] bg-surface p-6" style={{ border: "1px solid var(--border)" }}>
      <ul className="space-y-6">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <StepIcon state={step.state} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p
                  className="text-[15px] font-medium"
                  style={{
                    color:
                      step.state === "upcoming" ? "var(--text-secondary)" : "var(--ink)",
                  }}
                >
                  {step.title}
                </p>
                {step.action && step.state === "current" ? (
                  <Link
                    href={step.action.href}
                    className="text-[13.5px] no-underline hover:text-accent-hover"
                    style={{ color: "var(--accent)" }}
                  >
                    {step.action.label}
                  </Link>
                ) : null}
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                {step.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
