import { cn } from "@/base/lib/cn";

export type SectionTransitionTone = "paper" | "tint" | "panel" | "hero";

type SectionTransitionProps = {
  variant?: "wave" | "slope" | "beam";
  /** Surface color above the divider */
  from?: SectionTransitionTone;
  /** Surface color below the divider */
  to?: SectionTransitionTone;
  className?: string;
};

const TONE_FILL: Record<SectionTransitionTone, string> = {
  hero: "var(--section-surface-hero)",
  paper: "var(--section-surface-paper)",
  tint: "var(--section-surface-tint)",
  panel: "var(--section-surface-panel)",
};

export function SectionTransition({
  variant = "wave",
  from = "paper",
  to = "paper",
  className,
}: SectionTransitionProps) {
  const top = TONE_FILL[from];
  const bottom = TONE_FILL[to];

  if (variant === "beam") {
    return (
      <div
        aria-hidden
        className={cn("section-divider section-divider--beam", className)}
        style={{ background: top }}
      >
        <div className="section-divider__beam-track">
          <span className="section-divider__beam-line" />
          <span className="section-divider__beam-glow" />
        </div>
      </div>
    );
  }

  if (variant === "slope") {
    return (
      <div
        aria-hidden
        className={cn("section-divider section-divider--slope", className)}
        style={{ background: top }}
      >
        <div
          className="section-divider__slope"
          style={{ background: bottom }}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={cn("section-divider section-divider--wave", className)}
      style={{ background: top }}
    >
      <svg
        className="section-divider__wave-svg"
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="section-divider__wave-path"
          fill={bottom}
          d="M0,32 C240,8 480,56 720,32 C960,8 1200,56 1440,32 L1440,64 L0,64 Z"
        />
        <path
          className="section-divider__wave-path section-divider__wave-path--accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          d="M0,34 C280,12 520,58 720,34 C920,10 1160,54 1440,34"
        />
      </svg>
    </div>
  );
}
