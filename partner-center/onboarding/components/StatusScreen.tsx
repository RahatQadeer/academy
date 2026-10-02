import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Logo, Wordmark } from "@/base/components/Logo";

export function StatusScreen({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-canvas px-6">
      <div className="mx-auto max-w-[480px] py-14">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Logo size={22} />
            <Wordmark size={14} />
          </div>
          <p
            className="text-[12.5px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Private Attaché / Partner Center
          </p>
        </div>
        <h1 className="mb-4 text-[24px] font-bold tracking-[-0.4px]">{title}</h1>
        {children}
        <div className="mt-6">
          <Button href="/switcher" variant="secondary">
            Back to switcher
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Full-screen canvas with a single centred card — used by the submitted and
 *  application-status screens. */
export function StatusCanvas({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-canvas px-6">
      <div className="flex min-h-full items-center justify-center py-14">
        <div
          className="w-full max-w-[440px] rounded-card bg-surface p-8"
          style={{ border: "1px solid var(--border)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function PendingCopy() {
  return (
    <Callout title="Application received">
      Your Partner Center application is under review. You will not have access to
      referrals, earnings, or links until it is approved.
    </Callout>
  );
}

export function DeclinedCopy() {
  return (
    <Callout tone="warning" title="Application closed">
      This partner application was declined. Partner Center remains unavailable for
      this account.
    </Callout>
  );
}
