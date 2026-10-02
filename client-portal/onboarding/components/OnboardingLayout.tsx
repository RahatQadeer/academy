import { Logo } from "@/base/components/Logo";
import { ProgressBar } from "@/base/components/ProgressBar";
import { PageHeader } from "@/client-portal/components/PageHeader";

export const TOTAL_STEPS = 5;

/**
 * Onboarding covers the app shell rather than sitting inside it — a client who
 * has just accepted an invitation should not see the full sidebar mid-setup.
 * A fixed overlay keeps that entirely within this folder; the alternative would
 * mean teaching the shared `/app/[product]` layout about portal-specific paths.
 */
export function OnboardingLayout({
  step,
  accountName,
  title,
  description,
  children,
  footer,
}: {
  step: number;
  accountName: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto"
      style={{ background: "var(--canvas)" }}
    >
      <div className="mx-auto w-full max-w-[560px] px-6 py-12">
        <div className="mb-8 flex items-center gap-2.5">
          <Logo size={26} />
          <div>
            <div className="text-[14px] font-semibold leading-tight">
              {accountName}
            </div>
            <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              Client Portal
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div
            className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Step {step} of {TOTAL_STEPS}
          </div>
          <ProgressBar value={(step / TOTAL_STEPS) * 100} />
        </div>

        {/* The shared header, so a wizard step is titled at the same size and
            in the same grey as a settings pane — which is the screen it most
            resembles and the one a client sees next. */}
        <PageHeader title={title} subtitle={description} size={24} />

        <div>{children}</div>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  );
}
