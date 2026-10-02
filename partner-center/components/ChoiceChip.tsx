"use client";

import { cn } from "@/base/lib/cn";
import { pcType } from "@/partner-center/lib/typography";

// Wider, centered, equal-width variant of the shared Chip used by the
// application wizard's either/or rows. Border width stays constant so
// selecting an option does not shift the row.
export function ChoiceChip({
  selected,
  onClick,
  children,
  disabled = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "flex-1 rounded-control border-[1.5px] px-3 py-3 text-center transition-colors",
        pcType.control,
        selected
          ? "border-accent bg-[var(--accent-tint-mid)] text-accent-hover"
          : "border-line bg-surface text-[rgba(55,53,47,0.65)] hover:bg-surface-soft",
        disabled && "cursor-default hover:bg-surface opacity-90",
      )}
    >
      {children}
    </button>
  );
}
