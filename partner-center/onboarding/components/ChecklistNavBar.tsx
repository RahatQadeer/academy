import Link from "next/link";
import { Logo, Wordmark } from "@/base/components/Logo";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";

export function ChecklistNavBar({ right }: { right?: React.ReactNode }) {
  return (
    <header
      className="flex h-[72px] shrink-0 items-center justify-between bg-surface px-6 md:px-12"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2.5">
        <Logo size={26} />
        <Wordmark size={14.5} />
        <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          / Partner Center
        </span>
      </div>
      {right ?? null}
    </header>
  );
}

export function BackToChecklist() {
  return (
    <Link
      href={PARTNER_PATHS.checklist}
      className="text-[13px] no-underline hover:text-ink"
      style={{ color: "var(--text-tertiary)" }}
    >
      Back to checklist
    </Link>
  );
}

export function SetupCanvas({
  navRight,
  children,
  wide,
}: {
  navRight?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <ChecklistNavBar right={navRight} />
      <div className="flex-1 overflow-y-auto">
        <div
          className={`mx-auto flex min-h-full w-full flex-col px-6 py-10 ${
            wide ? "max-w-[720px] justify-start" : "max-w-[640px] justify-center"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
