"use client";

import { useState, type ReactNode } from "react";

/**
 * A form that is not there until it is asked for.
 *
 * A panel whose whole lower half is empty boxes reads as work outstanding:
 * four fields sitting under a list of people look like four people half
 * entered. The button is the honest state — there is nothing to fill in until
 * somebody decides to add one.
 *
 * Server-rendered children, so the form and its action are untouched; this
 * only decides whether they are on the screen.
 */
export function AddToggle({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-control border px-3 py-[7px] text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
        style={{ borderColor: "var(--border-strong)", color: "var(--accent)" }}
      >
        <span aria-hidden>+</span>
        {label}
      </button>
    );
  }

  return (
    <div>
      {children}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-[12.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        Cancel
      </button>
    </div>
  );
}
