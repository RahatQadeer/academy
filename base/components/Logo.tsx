import { cn } from "@/base/lib/cn";

type LogoProps = {
  size?: number;
  className?: string;
};

/**
 * Private Attaché monogram — briefcase mark from the brand asset.
 * Cream tile (#f7f5f0) with ink (#17181a) case; scales as a square.
 */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-hidden
    >
      <rect width="120" height="120" fill="#f7f5f0" />
      <g transform="translate(18 18) scale(0.7)">
        <path
          d="M40 46 60 22l20 24"
          stroke="#17181a"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M26 42h68c9.94 0 18 8.06 18 18v22c0 9.94-8.06 18-18 18H26C16.06 100 8 91.94 8 82V60c0-9.94 8.06-18 18-18Z"
          fill="#17181a"
        />
        <path
          d="M8 66h104M50 42 34 100M70 42l16 58"
          stroke="#f7f5f0"
          strokeWidth="6.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

export function Wordmark({
  size = 15,
  trademark = false,
}: {
  size?: number;
  trademark?: boolean;
}) {
  return (
    <span
      className="font-semibold tracking-tight"
      style={{ fontSize: size, color: "var(--ink)" }}
    >
      Private Attaché{trademark ? "™" : ""}
    </span>
  );
}
