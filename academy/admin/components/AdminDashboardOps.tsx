import Link from "next/link";
import { SectionHeading, Surface } from "@/academy/components/ui";
import type { AdminDashboardData } from "../types";
import { DonutChart, ProgressBreakdown, VerticalBars } from "./DashboardCharts";

const COLORS = {
  published: "var(--success-fg)",
  draft: "var(--text-tertiary)",
  pending: "#c9852c",
  active: "var(--accent)",
  completed: "var(--success-fg)",
  other: "var(--border-strong)",
  learners: "var(--module-academy-fg)",
  instructors: "var(--accent)",
  admins: "#2d4a5e",
} as const;

type QuickTone = "default" | "warning" | "success";

type QuickLink = {
  href: string;
  label: string;
  detail: string;
  tone?: QuickTone;
  icon: React.ReactNode;
};

const TONE_STOP: Record<QuickTone, { bg: string; fg: string }> = {
  default: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  success: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
};

/* — Inline stop icons (18px, currentColor) — */
const icons = {
  programs: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4.2c1.7-1 4.3-1 6 0v8.6c-1.7-1-4.3-1-6 0V4.2ZM14 4.2c-1.7-1-4.3-1-6 0v8.6c1.7-1 4.3-1 6 0V4.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  enrollments: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 12.5c0-2 1.8-3.2 4-3.2s4 1.2 4 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 9.6c1.7.2 3 1.4 3 3.1M10.6 2.9a2.4 2.4 0 0 1 .3 4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  instructors: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2 15 5.5 8 9 1 5.5 8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 7v3.2c0 1 1.8 2 4 2s4-1 4-2V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  approvals: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 1.6 13.5 4v3.4c0 3.3-2.3 5.7-5.5 6.9C4.8 13.1 2.5 10.7 2.5 7.4V4L8 1.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m5.8 7.6 1.6 1.6 3-3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  credentials: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3.5" width="12" height="9" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4.5 6.5h3M4.5 9h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11" cy="6.6" r="1.1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7 3.4 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

function ChartCard({
  title,
  description,
  href,
  accent,
  children,
}: {
  title: string;
  description: string;
  href?: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Surface elevated className="group/card flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[0_2px_4px_rgba(15,15,15,.05),0_12px_28px_rgba(15,15,15,.05)]">
      <div
        className="flex items-start justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="mt-[3px] h-5 w-1 shrink-0 rounded-full"
            style={{ background: accent }}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-semibold tracking-[-0.15px] text-ink">{title}</h3>
            <p className="mt-0.5 text-[12px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
              {description}
            </p>
          </div>
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-0.5 pt-0.5 text-[12.5px] font-medium text-accent no-underline transition-colors hover:text-accent-hover"
          >
            Open
            <span aria-hidden className="transition-transform duration-200 group-hover/card:translate-x-0.5">
              →
            </span>
          </Link>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col px-4 py-3.5">{children}</div>
    </Surface>
  );
}

export function AdminDashboardOps({ data }: { data: AdminDashboardData }) {
  const programSlices = [
    { label: "Live", value: data.programPublished, color: COLORS.published },
    { label: "Draft", value: data.programDraft, color: COLORS.draft },
    { label: "In review", value: data.programPendingApproval, color: COLORS.pending },
  ];

  const remainingEnrollments = Math.max(
    0,
    data.enrollmentCount - data.enrollmentActiveCount - data.enrollmentCompletedCount,
  );
  const enrollmentSlices = [
    { label: "In progress", value: data.enrollmentActiveCount, color: COLORS.active },
    { label: "Completed", value: data.enrollmentCompletedCount, color: COLORS.completed },
    { label: "Other", value: remainingEnrollments, color: COLORS.other },
  ].filter((slice) => slice.value > 0 || data.enrollmentCount === 0);

  const peopleSlices = [
    { label: "Learners", value: data.learnerCount, color: COLORS.learners },
    { label: "Instructors", value: data.instructorCount, color: COLORS.instructors },
    { label: "Admins", value: data.adminCount, color: COLORS.admins },
    ...(data.superAdminCount > 0
      ? [{ label: "Super Admins", value: data.superAdminCount, color: "var(--module-academy-fg)" }]
      : []),
  ];

  const quickLinks: QuickLink[] = [
    {
      href: "/academy/admin/programs",
      label: "Programs",
      detail: `${data.programTotal.toLocaleString()} in catalog`,
      icon: icons.programs,
    },
    {
      href: "/academy/admin/enrollments",
      label: "Enrollments",
      detail: `${data.learnerCount.toLocaleString()} learners`,
      icon: icons.enrollments,
    },
    {
      href: "/academy/admin/instructors",
      label: "Instructors",
      detail: `${data.instructorCount.toLocaleString()} active`,
      icon: icons.instructors,
    },
    {
      href: "/academy/admin/approvals",
      label: "Approvals",
      detail: data.pendingCount > 0 ? `${data.pendingCount} waiting` : "Clear",
      tone: data.pendingCount > 0 ? "warning" : "success",
      icon: icons.approvals,
    },
    {
      href: "/academy/admin/credentials",
      label: "Credentials",
      detail: data.credentialReviewCount > 0 ? `${data.credentialReviewCount} to review` : "Clear",
      tone: data.credentialReviewCount > 0 ? "warning" : "success",
      icon: icons.credentials,
    },
    {
      href: "/academy/admin/settings",
      label: "Settings",
      detail: "Defaults",
      icon: icons.settings,
    },
  ];

  return (
    <section aria-labelledby="admin-insights-heading" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionHeading id="admin-insights-heading">Insights</SectionHeading>
          <p className="-mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            Catalog mix, enrollment progress, and who is active across Academy.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard
          title="Catalog mix"
          description="Draft, review, and live programs."
          href="/academy/admin/programs"
          accent={COLORS.published}
        >
          <div className="flex flex-col items-center gap-3">
            <DonutChart
              slices={programSlices}
              size={112}
              thickness={12}
              centerValue={data.programTotal.toLocaleString()}
              centerLabel="programs"
            />
            <div
              className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t pt-3"
              style={{ borderColor: "var(--border)" }}
            >
              {programSlices.map((slice) => (
                <div key={slice.label} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background: slice.color,
                      boxShadow: `0 0 0 2px color-mix(in srgb, ${slice.color} 16%, transparent)`,
                    }}
                    aria-hidden
                  />
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {slice.label}
                  </span>
                  <span className="text-[12px] font-semibold tabular-nums text-ink">
                    {slice.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Enrollment progress"
          description="Where enrollments stand now."
          href="/academy/admin/enrollments"
          accent={COLORS.active}
        >
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[24px] font-bold tabular-nums tracking-[-0.6px] leading-none text-ink">
                  {data.enrollmentCount.toLocaleString()}
                </p>
                <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                  Total enrollments
                </p>
              </div>
              {data.enrollmentCount > 0 ? (
                <div className="pb-0.5 text-right">
                  <p className="text-[12px] font-semibold tabular-nums text-ink">
                    {data.enrollmentActiveCount.toLocaleString()} in progress
                  </p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {data.enrollmentCompletedCount.toLocaleString()} finished
                  </p>
                </div>
              ) : null}
            </div>

            <ProgressBreakdown
              slices={
                data.enrollmentCount === 0
                  ? [{ label: "No enrollments", value: 0, color: COLORS.other }]
                  : enrollmentSlices
              }
              emptyLabel="No enrollments yet"
            />
          </div>
        </ChartCard>

        <ChartCard
          title="People"
          description="Active membership by role."
          accent={COLORS.learners}
        >
          <VerticalBars slices={peopleSlices} maxHeight={64} />
        </ChartCard>
      </div>

      <Surface elevated className="overflow-hidden">
        <div
          className="flex items-center justify-between border-b px-5 py-3.5"
          style={{ borderColor: "var(--border)" }}
        >
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: "var(--text-tertiary)" }}>
            Quick links
          </h3>
          <span className="text-[12px]" style={{ color: "var(--text-disabled)" }}>
            Follow the path
          </span>
        </div>

        {/* The road — each quick link is a stop along a connected journey. */}
        <div className="overflow-x-auto px-3 py-6 sm:px-5">
          <ol className="flex min-w-[680px] items-start">
            {quickLinks.map((item, i) => {
              const stop = TONE_STOP[item.tone ?? "default"];
              const detailColor =
                item.tone === "warning"
                  ? "var(--warning-fg)"
                  : item.tone === "success"
                    ? "var(--success-fg)"
                    : "var(--text-tertiary)";
              return (
                <li key={item.href} className="relative flex flex-1 flex-col items-center">
                  {/* Road segment linking this stop back to the previous one */}
                  {i > 0 ? (
                    <span
                      aria-hidden
                      className="absolute right-1/2 top-[26px] h-[4px] w-full -translate-y-1/2 rounded-full"
                      style={{
                        background:
                          "repeating-linear-gradient(90deg, var(--border-strong) 0 10px, transparent 10px 18px)",
                      }}
                    />
                  ) : null}

                  <Link
                    href={item.href}
                    className="group relative flex w-full flex-col items-center gap-2.5 rounded-[12px] px-2 py-1 no-underline"
                  >
                    {/* Stop marker */}
                    <span
                      className="relative z-10 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface transition-transform duration-200 group-hover:-translate-y-1"
                      style={{ boxShadow: "0 0 0 4px var(--surface)" }}
                      aria-hidden
                    >
                      <span
                        className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-full transition-shadow duration-200"
                        style={{
                          background: stop.bg,
                          color: stop.fg,
                          boxShadow:
                            "inset 0 0 0 1.5px color-mix(in srgb, currentColor 22%, transparent), 0 6px 14px color-mix(in srgb, currentColor 20%, transparent)",
                        }}
                      >
                        {item.icon}
                      </span>
                    </span>

                    <span className="flex flex-col items-center text-center">
                      <span className="text-[13.5px] font-semibold text-ink transition-colors group-hover:text-accent">
                        {item.label}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: detailColor }}>
                        {item.tone && item.tone !== "default" ? (
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: detailColor }}
                            aria-hidden
                          />
                        ) : null}
                        {item.detail}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </Surface>
    </section>
  );
}
