import { ONBOARDING_STEPS } from "../lib/steps";

const STEP_LABELS = ["Account", "Interests", "Ready"] as const;

export function OnboardingProgress({
  step,
  total = 3,
}: {
  step: number;
  total?: number;
}) {
  return (
    <nav aria-label="Onboarding progress" className="mb-4 sm:mb-5">
      <ol className="grid grid-cols-3 gap-2">
        {STEP_LABELS.slice(0, total).map((label, index) => {
          const n = index + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className="min-w-0">
              <div
                className="h-1 rounded-full transition-colors"
                style={{
                  background: done || current ? "var(--accent)" : "var(--border-strong)",
                  opacity: current ? 1 : done ? 0.5 : 1,
                }}
              />
              <p
                className="mt-1.5 truncate text-[11px] font-medium"
                style={{
                  color: current
                    ? "var(--accent)"
                    : done
                      ? "var(--text-secondary)"
                      : "var(--text-tertiary)",
                }}
              >
                {n}. {label}
              </p>
            </li>
          );
        })}
      </ol>
      <p className="sr-only">
        Step {step} of {total}
        {ONBOARDING_STEPS[step - 1] ? `: ${ONBOARDING_STEPS[step - 1]}` : ""}
      </p>
    </nav>
  );
}
