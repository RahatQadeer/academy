import Link from "next/link";
import { cn } from "@/base/lib/cn";
import { ProgressBar } from "@/base/components/ProgressBar";

function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="shrink-0 opacity-40 transition-opacity group-hover:opacity-100"
    >
      <path
        d="M4 2.5L7.5 6L4 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type StatCardTone = "accent" | "success" | "warning" | "info";

export type StatCardProps = {
  value: number | string;
  label: string;
  detail?: string;
  href?: string;
  icon?: React.ReactNode;
  tone?: StatCardTone;
  progress?: number;
};

const TONE_STYLE: Record<StatCardTone, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-tint)", fg: "var(--accent)" },
  success: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  info: { bg: "var(--info-bg)", fg: "var(--info-fg)" },
};

const SHELL =
  "flex h-full min-h-[128px] flex-col rounded-[12px] border border-line bg-surface px-5 py-[18px]";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04)";

export function StatCard({
  value,
  label,
  detail,
  href,
  icon,
  tone = "accent",
  progress,
}: StatCardProps) {
  const chip = TONE_STYLE[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className="pt-0.5 text-[12px] font-semibold uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </p>
        {icon ? (
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: chip.bg, color: chip.fg }}
            aria-hidden
          >
            {icon}
          </span>
        ) : href ? (
          <span style={{ color: "var(--text-tertiary)" }}>
            <ArrowIcon />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[32px] font-bold leading-none tracking-[-1px] tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {detail ? (
        <p
          className="mt-auto pt-3 text-[12.5px] leading-snug"
          style={{ color: "var(--text-tertiary)" }}
        >
          {detail}
        </p>
      ) : (
        <span className="mt-auto pt-3" aria-hidden />
      )}
      {progress !== undefined ? (
        <div className="mt-3">
          <ProgressBar value={progress} tone={tone === "success" ? "success" : "default"} />
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          SHELL,
          "group text-ink no-underline transition-[border-color,background] hover:border-line-strong hover:bg-surface-soft",
        )}
        style={{ boxShadow: CARD_SHADOW }}
      >
        {body}
      </Link>
    );
  }

  return (
    <article className={SHELL} style={{ boxShadow: CARD_SHADOW }}>
      {body}
    </article>
  );
}

/** Responsive stat row — 1 column on mobile, 2 on tablet, `columns` on desktop. */
export function StatGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
}) {
  const desktop =
    columns === 2 ? "lg:grid-cols-2" : columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return <div className={cn("grid gap-4 sm:grid-cols-2", desktop)}>{children}</div>;
}
