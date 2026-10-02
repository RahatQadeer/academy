"use client";

import Link from "next/link";
import { cn } from "@/base/lib/cn";

/**
 * Dialog rendered over the current screen.
 *
 * Usually closed by navigating to `closeHref` (URL-driven open state). Pass
 * `onClose` instead when the dialog is opened from client state — then the
 * ✕ and Cancel do not reload the page behind it.
 */
export function Modal({
  title,
  eyebrow,
  closeHref,
  onClose,
  width = 520,
  dense,
  bareHeader,
  noClose,
  pad,
  closeGlyph = "✕",
  closeSize = 15,
  titleSize = 19,
  headerGap = 18,
  scrim = "rgba(55,53,47,.45)",
  children,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  closeHref?: string;
  onClose?: () => void;
  width?: number;
  dense?: boolean;
  bareHeader?: boolean;
  noClose?: boolean;
  pad?: string;
  closeGlyph?: string;
  closeSize?: number;
  titleSize?: number;
  headerGap?: number;
  scrim?: string;
  children: React.ReactNode;
}) {
  const closeControl =
    noClose ? null : onClose ? (
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] leading-none transition-colors hover:bg-[rgba(55,53,47,0.07)]"
        style={{ fontSize: closeSize, color: "rgba(55,53,47,.4)" }}
      >
        {closeGlyph}
      </button>
    ) : closeHref ? (
      <Link
        href={closeHref}
        aria-label="Close"
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] leading-none no-underline transition-colors hover:bg-[rgba(55,53,47,0.07)]"
        style={{ fontSize: closeSize, color: "rgba(55,53,47,.4)" }}
      >
        {closeGlyph}
      </Link>
    ) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-6"
      style={{ background: scrim }}
    >
      <div
        className={cn(
          "my-auto w-full rounded-card bg-surface",
          pad ?? (dense ? "px-[30px] py-7" : "p-8"),
        )}
        style={{
          maxWidth: width,
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          boxShadow: "0 12px 40px rgba(15,15,15,.18)",
        }}
      >
        <div
          className={cn(
            "flex items-start justify-between gap-4",
            bareHeader && (eyebrow ? "mb-1" : "-mb-4 justify-end"),
          )}
        >
          {bareHeader && !eyebrow ? null : eyebrow ? (
            <div className="min-w-0 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {eyebrow}
            </div>
          ) : (
            <h2 className="font-bold" style={{ fontSize: titleSize }}>
              {title}
            </h2>
          )}
          {closeControl}
        </div>

        {bareHeader ? null : eyebrow ? (
          <h2 className="mt-1.5 font-bold" style={{ fontSize: titleSize, marginBottom: headerGap }}>
            {title}
          </h2>
        ) : (
          <div style={{ marginBottom: headerGap }} />
        )}

        {children}
      </div>
    </div>
  );
}
