"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/base/lib/cn";
import { pcType } from "@/partner-center/lib/typography";

export type FilterSelectOption = {
  value: string;
  label: string;
};

/**
 * Compact filter dropdown — Whitby-style trigger + green selected row.
 * Replaces native &lt;select&gt; in filter bars so open menus match Partner theme.
 */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
  minWidth,
}: {
  label: string;
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  minWidth?: number;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex shrink-0", className)}
      style={minWidth ? { minWidth } : undefined}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-[10px] border bg-surface py-[9px] pl-3 pr-2.5 text-left transition-colors",
          pcType.body,
          "hover:bg-[var(--surface-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]",
        )}
        style={{
          borderColor: open ? "var(--accent)" : "var(--border-strong)",
          color: "var(--ink)",
          boxShadow: open
            ? "0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent)"
            : undefined,
        }}
      >
        <span className="truncate">{selected?.label ?? label}</span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          className={cn(
            "shrink-0 transition-transform",
            open && "rotate-180",
          )}
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-[calc(100%+6px)] z-50 m-0 min-w-full list-none overflow-hidden rounded-[12px] bg-surface p-1 shadow-[0_12px_32px_-12px_rgba(15,15,15,0.22)]"
          style={{
            border: "1px solid var(--border)",
            minWidth: Math.max(minWidth ?? 0, 160),
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={`${option.value}-${option.label}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full items-center rounded-[8px] border-0 px-3 py-2 text-left transition-colors",
                    pcType.body,
                    isSelected ? "font-semibold" : "font-normal",
                  )}
                  style={{
                    background: isSelected
                      ? "var(--accent-tint)"
                      : "transparent",
                    color: isSelected ? "var(--accent)" : "var(--ink)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(event) => {
                    if (!isSelected) {
                      event.currentTarget.style.background =
                        "var(--surface-soft)";
                    }
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = isSelected
                      ? "var(--accent-tint)"
                      : "transparent";
                  }}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
