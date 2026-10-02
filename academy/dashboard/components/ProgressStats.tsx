"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/base/lib/cn";
import type { DashboardStats } from "../types";

type Metric = {
  key: string;
  value: number;
  label: string;
  href: string;
};

function useCountUp(target: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      return;
    }

    let frame = 0;
    const duration = 480;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

function MetricCell({
  metric,
  index,
  active,
}: {
  metric: Metric;
  index: number;
  active: boolean;
}) {
  const display = useCountUp(metric.value);

  return (
    <li className="min-w-0">
      <Link
        href={metric.href}
        className={cn(
          "group relative block h-full overflow-hidden rounded-[14px] border border-line bg-surface px-3.5 py-3.5 text-ink no-underline outline-none transition-[transform,box-shadow,border-color] duration-200 sm:px-4",
          "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_24px_rgba(15,15,15,0.06)]",
          "focus-visible:border-accent",
          active && "border-[color-mix(in_srgb,var(--accent)_28%,var(--border))]",
        )}
        style={
          active
            ? { background: "color-mix(in srgb, var(--accent-tint) 70%, white)" }
            : undefined
        }
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
          style={{ background: "var(--accent)" }}
        />
        <p
          className="text-[11px] font-medium uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {metric.label}
        </p>
        <p
          className="academy-desk-metric-value mt-2 text-[24px] font-bold leading-none tracking-[-0.7px] tabular-nums transition-colors duration-200 group-hover:text-accent sm:text-[26px]"
          style={{ animationDelay: `${index * 35}ms` }}
        >
          {display.toLocaleString()}
        </p>
      </Link>
    </li>
  );
}

export function ProgressStats({ stats }: { stats: DashboardStats }) {
  const metrics: Metric[] = [
    { key: "enrolled", value: stats.coursesEnrolled, label: "Enrolled", href: "/academy/learning" },
    {
      key: "in-progress",
      value: stats.coursesInProgress,
      label: "In progress",
      href: "/academy/learning",
    },
    {
      key: "completed",
      value: stats.coursesCompleted,
      label: "Completed",
      href: "/academy/learning",
    },
    {
      key: "certificates",
      value: stats.certificatesEarned,
      label: "Certificates",
      href: "/academy/credentials",
    },
    {
      key: "credentials",
      value: stats.credentialsAwarded,
      label: "Credentials",
      href: "/academy/credentials",
    },
  ];

  const focusKey =
    stats.coursesInProgress > 0
      ? "in-progress"
      : stats.coursesEnrolled > 0
        ? "enrolled"
        : "completed";

  return (
    <section aria-labelledby="learner-progress-heading" className="academy-desk-reveal academy-desk-reveal-d1">
      <h2
        id="learner-progress-heading"
        className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.07em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Performance
      </h2>

      <div
        className="overflow-x-auto"
      >
        <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3 xl:grid-cols-5">
          {metrics.map((metric, index) => (
            <MetricCell
              key={metric.key}
              metric={metric}
              index={index}
              active={metric.key === focusKey}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
