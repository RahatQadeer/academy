import { cn } from "@/base/lib/cn";

type Tone = "info" | "warning" | "success" | "danger";

const tones: Record<Tone, { bg: string; border: string; fg: string }> = {
  info: {
    bg: "var(--accent-tint-mid)",
    border: "var(--accent-tint)",
    fg: "var(--info-fg)",
  },
  warning: {
    bg: "var(--warning-bg)",
    border: "var(--warning-border)",
    fg: "var(--warning-fg)",
  },
  success: {
    bg: "var(--success-bg)",
    border: "var(--success-bg)",
    fg: "var(--success-fg)",
  },
  danger: {
    bg: "var(--danger-bg)",
    border: "var(--danger-bg)",
    fg: "var(--danger-fg)",
  },
};

export function Callout({
  tone = "info",
  title,
  size = 13.5,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  /**
   * The reference does not set one size for these. Most are 13.5px; WP.4's
   * note under the dials is 12.5. Passed rather than overridden with a class,
   * because two competing text sizes on one element are settled by the order
   * the stylesheet happens to emit them in, not by the order they are written.
   */
  size?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const colors = tones[tone];
  return (
    <div
      className={cn("rounded-lg px-3.5 py-3 leading-relaxed", className)}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.fg,
        fontSize: size,
      }}
    >
      {title ? <div className="font-semibold mb-0.5">{title}</div> : null}
      <div>{children}</div>
    </div>
  );
}
