"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type QuickAddItem = {
  href: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
};

/**
 * The persistent Quick Add control SRS §2.4 requires near the top of the nav
 * rail, with the entries each product chooses.
 *
 * Optional by design: a product that passes no items gets no button, so the
 * three modules that have not defined theirs are unaffected.
 */
export function QuickAdd({
  items,
  compact,
}: {
  items: QuickAddItem[];
  /**
   * WP.2's own Quick Add — a 34px square beside the page title rather than the
   * full-width control in the rail. Same menu, same entries; a list screen
   * draws the trigger where its header has room for it.
   */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className={compact ? "relative" : "relative px-3.5 pb-3.5"}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={compact ? "Quick Add" : undefined}
        aria-label={compact ? "Quick Add" : undefined}
        className={
          compact
            ? "flex h-[34px] w-[34px] items-center justify-center rounded-control border border-line-strong bg-surface text-[17px] leading-none transition-colors hover:bg-[var(--surface-soft)]"
            : "flex w-full items-center justify-center gap-1.5 rounded-control border border-line-strong bg-surface py-[7px] text-[13px] font-medium"
        }
        style={compact ? { color: "var(--ink)" } : undefined}
      >
        {compact ? (
          <span aria-hidden>+</span>
        ) : (
          <>
            <span className="text-[14px] leading-none">+</span>
            Quick Add
          </>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className={
            compact
              ? "absolute right-0 top-full z-40 mt-1.5 overflow-hidden rounded-[10px] border border-line bg-surface"
              : "absolute left-3.5 right-3.5 z-40 mt-1.5 overflow-hidden rounded-[10px] border border-line bg-surface"
          }
          style={{ boxShadow: "0 6px 20px rgba(15,15,15,.10)", width: 280 }}
        >
          {items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-start gap-2.5 border-b border-line px-3.5 py-2.5 no-underline last:border-b-0 hover:bg-[var(--surface-soft)]"
            >
              <span
                className="mt-[1px] w-4 shrink-0 text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
                aria-hidden
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                  {item.label}
                </span>
                <span
                  className="block text-[12px] leading-[1.4]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
