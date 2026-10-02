"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/base/lib/cn";

export function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const wanted = [1, page - 1, page, page + 1, pageCount].filter(
    (value) => value >= 1 && value <= pageCount,
  );
  const unique = [...new Set(wanted)].sort((a, b) => a - b);

  const entries: Array<number | "gap"> = [];
  let previous = 0;
  for (const current of unique) {
    if (previous > 0 && current - previous > 1) entries.push("gap");
    entries.push(current);
    previous = current;
  }
  return entries;
}

export function PaginationBar({
  page,
  pageCount,
  total,
  rangeStart,
  rangeEnd,
  itemLabel,
  hrefForPage,
  onPageChange,
  compact = false,
  showRange = true,
  label = "Pagination",
}: {
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  itemLabel?: string;
  hrefForPage?: (page: number) => string;
  onPageChange?: (page: number) => void;
  compact?: boolean;
  showRange?: boolean;
  label?: string;
}) {
  if (pageCount <= 1 || total === 0) return null;

  const entries = pageWindow(page, pageCount);
  const progress = pageCount <= 1 ? 0 : (page - 1) / (pageCount - 1);

  return (
    <nav
      className={cn(
        "flex items-center gap-3",
        compact ? "justify-end" : showRange ? "flex-wrap justify-between gap-y-3" : "justify-center",
      )}
      aria-label={label}
    >
      {showRange ? (
      <p
        className={cn("min-w-0 tabular-nums", compact ? "hidden sm:block" : "min-w-[7.5rem]")}
        style={{ color: "var(--text-tertiary)" }}
      >
        <span
          className={cn("font-semibold tracking-[-0.2px]", compact ? "text-[12.5px]" : "text-[15px]")}
          style={{ color: "var(--ink)" }}
        >
          {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
        </span>
        <span className={cn(compact ? "text-[12.5px]" : "mt-0.5 block text-[12px]")}>
          {compact ? " " : null}
          of {total.toLocaleString()}
          {itemLabel ? ` ${itemLabel}` : ""}
        </span>
      </p>
      ) : null}

      <div
        className={cn(
          "inline-flex items-center",
          compact ? "gap-0.5 rounded-[10px] border p-0.5" : "gap-1.5",
        )}
        style={
          compact
            ? { borderColor: "var(--border)", background: "var(--surface)" }
            : undefined
        }
      >
        <StepControl
          label="Previous page"
          disabled={page <= 1}
          href={page > 1 ? hrefForPage?.(page - 1) : undefined}
          onClick={page > 1 && onPageChange ? () => onPageChange(page - 1) : undefined}
          compact={compact}
        >
          <Chevron direction="left" />
        </StepControl>

        <div className={cn("relative flex items-center", compact ? "px-0.5" : "px-1")}>
          {!compact ? (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute left-5 right-5 top-1/2 h-px"
                style={{ background: "var(--border-strong)" }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute left-5 top-1/2 h-px origin-left"
                style={{
                  width: "calc(100% - 2.5rem)",
                  background: "var(--accent)",
                  transform: `scaleX(${progress})`,
                }}
              />
            </>
          ) : null}

          {entries.map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                aria-hidden
                className="relative z-[1] px-1 text-[12px] font-medium"
                style={{
                  color: "var(--text-tertiary)",
                  background: compact ? "transparent" : "var(--surface)",
                }}
              >
                ···
              </span>
            ) : (
              <PageBead
                key={entry}
                page={entry}
                current={entry === page}
                href={entry === page ? undefined : hrefForPage?.(entry)}
                onClick={
                  entry === page || !onPageChange ? undefined : () => onPageChange(entry)
                }
                compact={compact}
              />
            ),
          )}
        </div>

        <StepControl
          label="Next page"
          disabled={page >= pageCount}
          href={page < pageCount ? hrefForPage?.(page + 1) : undefined}
          onClick={page < pageCount && onPageChange ? () => onPageChange(page + 1) : undefined}
          compact={compact}
        >
          <Chevron direction="right" />
        </StepControl>
      </div>
    </nav>
  );
}

function PageBead({
  page,
  current,
  href,
  onClick,
  compact,
}: {
  page: number;
  current: boolean;
  href?: string;
  onClick?: () => void;
  compact: boolean;
}) {
  const className = cn(
    "relative z-[1] inline-flex shrink-0 items-center justify-center rounded-full text-[12.5px] tabular-nums no-underline transition-[background,color,box-shadow,transform] duration-150",
    compact ? "h-7 min-w-7 px-1.5" : "h-8 min-w-8 px-2",
    current ? "font-semibold" : "cursor-pointer font-medium hover:text-ink",
  );
  const style = current
    ? {
        background: "var(--accent)",
        color: "#fff",
        boxShadow: compact
          ? "0 1px 2px color-mix(in srgb, var(--accent) 35%, transparent)"
          : "0 0 0 3px var(--accent-tint), 0 4px 10px color-mix(in srgb, var(--accent) 22%, transparent)",
      }
    : {
        background: compact ? "transparent" : "var(--surface)",
        color: "var(--text-secondary)",
      };

  const content = page;

  if (current) {
    return (
      <span className={className} style={style} aria-current="page" aria-label={`Page ${page}`}>
        {content}
      </span>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className} style={style} aria-label={`Page ${page}`}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={{ ...style, border: "none" }}
      aria-label={`Page ${page}`}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

function StepControl({
  label,
  disabled,
  href,
  onClick,
  compact,
  children,
}: {
  label: string;
  disabled: boolean;
  href?: string;
  onClick?: () => void;
  compact: boolean;
  children: ReactNode;
}) {
  const className = cn(
    "inline-flex shrink-0 items-center justify-center rounded-full no-underline transition-colors",
    compact ? "h-7 w-7" : "h-8 w-8",
    disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer hover:bg-[var(--surface-soft)]",
  );
  const style = {
    color: "var(--text-secondary)",
    background: compact ? "transparent" : "var(--surface)",
    border: compact ? "none" : "1px solid var(--border)",
  };

  if (disabled || (!href && !onClick)) {
    return (
      <span className={className} style={style} aria-label={label} aria-disabled="true">
        {children}
      </span>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className} style={style} aria-label={label}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={{ ...style, border: compact ? "none" : style.border, cursor: "pointer" }}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d={direction === "left" ? "M8.5 3.5 5 7l3.5 3.5" : "M5.5 3.5 9 7l-3.5 3.5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
