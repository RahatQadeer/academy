import { cn } from "@/base/lib/cn";
import Link from "next/link";

export function ModuleCard({
  name,
  description,
  href,
  iconBg,
  iconFg,
  glyph,
  state = "available",
  actionLabel,
}: {
  name: string;
  description: string;
  href: string;
  iconBg: string;
  iconFg: string;
  glyph: string;
  state?: "available" | "current" | "inactive";
  actionLabel?: string;
}) {
  const inactive = state === "inactive";
  const current = state === "current";

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-card p-4 no-underline transition-colors",
        inactive && "opacity-70",
      )}
      style={{
        background: current ? "var(--accent-tint-soft)" : "var(--surface)",
        border: current
          ? "1.5px solid var(--accent)"
          : inactive
            ? "1px dashed var(--border-dashed)"
            : "1px solid var(--border)",
        color: "var(--ink)",
      }}
    >
      <span
        className="mb-3 inline-flex h-[36px] w-[36px] items-center justify-center text-[13px] font-semibold"
        style={{
          background: iconBg,
          color: iconFg,
          borderRadius: 9,
        }}
      >
        {glyph}
      </span>
      <div className="text-[15px] font-semibold">{name}</div>
      <p
        className="mt-1 text-[13.5px] leading-relaxed no-underline"
        style={{ color: "var(--text-secondary)" }}
      >
        {description}
      </p>
      {actionLabel ? (
        <div className="mt-3 text-[13px] font-medium text-accent">
          {actionLabel}
        </div>
      ) : null}
    </Link>
  );
}
