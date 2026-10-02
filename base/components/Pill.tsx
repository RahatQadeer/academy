import { cn } from "@/base/lib/cn";

type Tone = "success" | "warning" | "danger" | "review" | "info" | "neutral" | "accent";

const tones: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: "var(--success-bg)", fg: "var(--success-fg)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning-fg)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
  /** 11.2's "Needs Review" — asks for a look, where danger says it is wrong. */
  review: { bg: "var(--review-bg)", fg: "var(--review-fg)" },
  info: { bg: "var(--info-bg)", fg: "var(--info-fg)" },
  // #f1f1ef and .6, which is what the reference draws 18 times without
  // variation — a shade darker than the table header it often sits under.
  neutral: { bg: "var(--canvas)", fg: "var(--text-muted)" },
  accent: { bg: "var(--accent-tint)", fg: "var(--accent)" },
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const colors = tones[tone];
  return (
    <span
      className={cn(
        // The reference draws every pill the same way, 293 times without
        // variation: 10.5px medium, 4px radius, 2px/7px padding.
        "inline-flex items-center whitespace-nowrap rounded px-[7px] py-[2px] text-[10.5px] font-medium",
        className,
      )}
      style={{ background: colors.bg, color: colors.fg }}
    >
      {children}
    </span>
  );
}
