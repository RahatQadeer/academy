"use client";

import type { FormEvent } from "react";
import { cn } from "@/base/lib/cn";

export function ExploreSearchBar({
  value,
  onChange,
  onClear,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  className?: string;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  const filled = Boolean(value);

  return (
    <form className={cn("relative min-w-0 flex-1", className)} onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="explore-search">
        Search programs and courses
      </label>
      <div
        className={cn(
          "group flex h-9 items-center gap-2.5 rounded-[8px] border px-2.5 transition-[border-color,box-shadow,background] duration-200",
          "focus-within:border-accent focus-within:bg-surface",
          "focus-within:shadow-[0_0_0_3px_var(--accent-tint)]",
        )}
        style={{
          background: filled ? "var(--surface)" : "var(--surface)",
          borderColor: filled
            ? "color-mix(in srgb, var(--accent) 22%, var(--border-strong))"
            : "var(--border-strong)",
        }}
      >
        <span
          className="inline-flex shrink-0 items-center justify-center"
          style={{ color: "var(--text-tertiary)" }}
          aria-hidden
        >
          <SearchIcon />
        </span>
        <input
          id="explore-search"
          name="q"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search programs, skills, or topics"
          autoComplete="off"
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-[13.5px] text-ink outline-none placeholder:text-[rgba(55,53,47,0.4)]"
        />
        {filled ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-[6px] border-0 transition-colors hover:bg-[var(--surface-soft)]"
            style={{ color: "var(--text-secondary)", background: "transparent" }}
          >
            <ClearIcon />
          </button>
        ) : null}
      </div>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.4 12.4 16 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
