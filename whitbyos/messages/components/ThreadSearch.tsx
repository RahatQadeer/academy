"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search across the conversations in the rail.
 *
 * It writes to the URL rather than holding its own list, so a search survives
 * a refresh, can be linked to, and needs no second copy of the threads to
 * filter. Debounced, because it replaces the URL as you type and every
 * replacement re-runs the page.
 */
export function ThreadSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("q") ?? "";

  const [value, setValue] = useState(current);

  // Someone navigating (a filter, another tab) brings its own q with it.
  useEffect(() => setValue(current), [current]);

  useEffect(() => {
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      // A search is not a place you want to press Back through.
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, current, params, pathname, router]);

  return (
    /*
     * A drawn magnifier, not "⌕".
     *
     * The glyph is a character rather than an icon: it renders at whatever
     * weight the font has for it, which here was a hairline circle floating
     * above the baseline and reading as a smudge. And a field with a focus
     * state tells you where the typing is going.
     */
    <label
      className="pa-chat-search flex items-center gap-2 rounded-full border px-3.5 py-[8px] transition-colors"
      style={{
        background: "var(--surface-soft)",
        borderColor: "var(--chrome-line)",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
        <circle cx="7" cy="7" r="4.6" stroke="var(--text-tertiary)" strokeWidth="1.5" />
        <path
          d="m10.6 10.6 3 3"
          stroke="var(--text-tertiary)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search conversations"
        aria-label="Search conversations"
        className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none"
        style={{ color: "var(--ink)" }}
      />

      {value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[12px] leading-none transition-colors hover:bg-[var(--surface-active)]"
          style={{ color: "var(--text-tertiary)" }}
        >
          ×
        </button>
      ) : null}
    </label>
  );
}
