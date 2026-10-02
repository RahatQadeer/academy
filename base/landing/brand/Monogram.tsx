import { cn } from "@/base/lib/cn";

type MonogramVariant = "ink" | "cream" | "onBlue" | "app" | "signal";

const VARIANTS: Record<
  MonogramVariant,
  { peak: string; body: string; lines: string; peakWidth: number; lineWidth: number }
> = {
  ink: {
    peak: "#17181a",
    body: "#17181a",
    lines: "#f7f5f0",
    peakWidth: 11,
    lineWidth: 7,
  },
  cream: {
    peak: "#f7f5f0",
    body: "#f7f5f0",
    lines: "#17181a",
    peakWidth: 10,
    lineWidth: 6.5,
  },
  onBlue: {
    peak: "#f7f5f0",
    body: "#f7f5f0",
    lines: "#2383e2",
    peakWidth: 10,
    lineWidth: 6.5,
  },
  app: {
    peak: "#2383e2",
    body: "#f7f5f0",
    lines: "#17181a",
    peakWidth: 10,
    lineWidth: 6.5,
  },
  signal: {
    peak: "#f7f5f0",
    body: "var(--pa-blue)",
    lines: "var(--pa-tint)",
    peakWidth: 10,
    lineWidth: 6.5,
  },
};

type MonogramProps = {
  size?: number;
  variant?: MonogramVariant;
  className?: string;
  title?: string;
  /** Favicon / tiny sizes: thicker cut stroke */
  dense?: boolean;
};

export function Monogram({
  size = 24,
  variant = "ink",
  className,
  title,
  dense,
}: MonogramProps) {
  const colors = VARIANTS[variant];
  const labeled = Boolean(title);
  const peakWidth = dense ? 12 : colors.peakWidth;
  const lineWidth = dense ? 8 : colors.lineWidth;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={labeled ? undefined : true}
      role={labeled ? "img" : undefined}
    >
      {labeled ? <title>{title}</title> : null}
      <path
        d="M40 46 60 22l20 24"
        stroke={colors.peak}
        strokeWidth={peakWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 42h68c9.94 0 18 8.06 18 18v22c0 9.94-8.06 18-18 18H26C16.06 100 8 91.94 8 82V60c0-9.94 8.06-18 18-18Z"
        fill={colors.body}
      />
      <path
        d="M8 66h104M50 42 34 100M70 42l16 58"
        stroke={colors.lines}
        strokeWidth={lineWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

type BrandMarkProps = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
};

/** Nav / footer lockup: ink monogram + wordmark (no tile). */
export function BrandMark({
  size = 22,
  showWordmark = true,
  className,
  wordmarkClassName,
}: BrandMarkProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-[9px]", className)}>
      <Monogram size={size} variant="ink" className="shrink-0" />
      {showWordmark ? (
        <span
          className={cn(
            "truncate text-[15px] font-bold tracking-[-0.2px] text-[#141414]",
            wordmarkClassName,
          )}
        >
          Private Attaché
        </span>
      ) : null}
    </div>
  );
}
