import Link from "next/link";
import { SectionHeading } from "@/academy/components/ui";
import { programTypeLabel } from "@/academy/lib/domain";
import { lessonPlayerHref } from "@/academy/lesson-player/utils/curriculum";
import type { ContinueLearningItem } from "../types";
import { EmptyLearningState } from "./EmptyLearningState";

function badgeColors(type: ContinueLearningItem["programType"]) {
  if (type === "certification_program") {
    return {
      background: "var(--module-academy-bg)",
      color: "var(--module-academy-fg)",
    };
  }
  return {
    background: "var(--module-whitby-bg)",
    color: "var(--module-whitby-fg)",
  };
}

function ProgressRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative h-10 w-10 shrink-0" aria-hidden>
      <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10.5px] font-semibold tabular-nums">
        {clamped}%
      </span>
    </div>
  );
}

function ContinueCard({ item, index }: { item: ContinueLearningItem; index: number }) {
  const badge = badgeColors(item.programType);
  const progressLabel =
    item.progressPercent > 0 ? `${Math.min(100, item.progressPercent)}% complete` : "Not started";

  return (
    <Link
      href={lessonPlayerHref(item.programId)}
      className="group academy-learner-card relative block overflow-hidden rounded-[16px] border border-line bg-surface p-5 pl-6 text-ink no-underline"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] origin-top scale-y-100 rounded-r-full"
        style={{ background: "var(--module-academy-fg)", opacity: 0.55 }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex rounded-[4px] px-2 py-[2px] text-[10.5px] font-medium"
            style={badge}
          >
            {programTypeLabel(item.programType)}
          </span>
          <h3 className="mt-2 text-[15.5px] font-semibold leading-snug tracking-[-0.2px] text-pretty transition-colors duration-200 group-hover:text-accent">
            {item.headline}
          </h3>
        </div>
        <ProgressRing value={item.progressPercent} />
      </div>

      <div className="mt-4">
        <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
          <div
            className="academy-desk-progress-fill h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, item.progressPercent))}%`,
              background: "var(--accent)",
              animationDelay: `${100 + index * 60}ms`,
            }}
          />
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-[12px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
          {progressLabel}
        </p>
        <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
          Resume
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

export function ContinueLearning({ items }: { items: ContinueLearningItem[] }) {
  return (
    <section
      aria-labelledby="continue-learning-heading"
      className="academy-desk-reveal academy-desk-reveal-d2"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <SectionHeading id="continue-learning-heading" className="mb-0">
          Continue learning
        </SectionHeading>
        {items.length > 0 ? (
          <Link
            href="/academy/learning"
            className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-accent no-underline transition-colors hover:text-accent-hover"
          >
            View all
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyLearningState />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {items.map((item, index) => (
            <ContinueCard key={item.enrollmentId} item={item} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}
