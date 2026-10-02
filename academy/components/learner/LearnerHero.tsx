import type { ReactNode } from "react";
import { cn } from "@/base/lib/cn";

export function LearnerHero({
  eyebrow,
  title,
  description,
  trailing,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("academy-learner-hero relative mb-7 overflow-hidden px-5 py-6 sm:px-7 sm:py-7", className)}>
      <div aria-hidden className="academy-learner-hero-wash pointer-events-none absolute inset-0" />
      <div aria-hidden className="academy-learner-hero-orb pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full" />
      <div aria-hidden className="academy-learner-hero-orb-2 pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-[54ch]">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--module-academy-fg)" }}>
              <span className="inline-block size-1.5 rounded-full" style={{ background: "var(--module-academy-fg)" }} />
              {eyebrow}
            </p>
            <h1 className="mt-2 text-[30px] font-bold leading-[1.08] tracking-[-0.7px] text-pretty sm:text-[34px]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-pretty" style={{ color: "var(--text-secondary)" }}>
                {description}
              </p>
            ) : null}
          </div>
          {trailing ? <div className="relative shrink-0 self-start sm:self-auto">{trailing}</div> : null}
        </div>
        {children}
      </div>
    </header>
  );
}
