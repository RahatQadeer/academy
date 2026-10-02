"use client";

import { cn } from "@/base/lib/cn";

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-control border px-3 py-2 text-left text-[13.5px] transition-colors",
        selected
          ? "border-accent bg-[var(--accent-tint-mid)] text-accent-hover"
          : "border-line text-[var(--text-secondary)] hover:bg-surface-soft",
      )}
    >
      {children}
    </button>
  );
}
