import { Logo } from "@/base/components/Logo";

export function OnboardingHeader() {
  return (
    <header className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
      <div className="flex items-center gap-2.5">
        <Logo size={26} />
        <div className="min-w-0">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--accent)" }}
          >
            Private Attaché
          </p>
          <p className="text-[15.5px] font-bold tracking-[-0.3px] text-ink">Academy</p>
        </div>
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
      >
        Learner
      </span>
    </header>
  );
}
