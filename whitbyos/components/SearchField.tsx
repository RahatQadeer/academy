"use client";

import type { CSSProperties } from "react";

/**
 * A search box that looks like one.
 *
 * Every screen in this product grew its own: a bare bordered input with
 * "Search Playbooks…" ghosted in it, and nothing else to say what it was. A
 * box is a box — the only thing separating a search from a name field was a
 * placeholder that disappears the moment somebody types, which is exactly
 * when they most want to know what they are looking at.
 *
 * So the glass is inside the box, on the left, and it stays. It is drawn
 * rather than typed: 🔍 renders as a colour emoji on macOS and as a black
 * glyph on Windows, at two different sizes, and neither of them takes the
 * field's own colour.
 *
 * Deliberately a server component with no state. These live inside plain GET
 * forms — the query goes in the URL, so a search survives a refresh and can
 * be sent to somebody — and adding React state to that would be adding a
 * second answer to a question the URL already answers.
 */
export function SearchField({
  name = "q",
  defaultValue = "",
  placeholder,
  label,
  className = "",
  style,
  autoFocus,
  onSearch,
}: {
  /** The query parameter it posts as. `q` everywhere unless a screen collides. */
  name?: string;
  defaultValue?: string;
  placeholder: string;
  /**
   * What it searches, for a screen reader. Without one the field is announced
   * as its placeholder, which is a sentence rather than a name.
   */
  label: string;
  /** Width and margins from the screen it sits on; the box itself is here. */
  className?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  /**
   * Told on every keystroke, where the list filters itself.
   *
   * Without it this stays what it was: a plain field in a GET form, whose
   * query goes in the URL and whose search runs on the server.
   */
  onSearch?: (value: string) => void;
}) {
  return (
    <div className={`relative ${className}`} style={style}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2"
        style={{ color: "var(--text-quiet)" }}
      >
        <Glass />
      </span>

      <input
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        onChange={onSearch ? (event) => onSearch(event.target.value) : undefined}
        /* py-2 rather than a rounder number, because these stand beside
           `FilterSelect`, and a search box a pixel taller than the selects
           next to it is a row that looks slightly broken without anybody
           being able to say why. */
        className="w-full rounded-control border py-2 pl-[34px] pr-3 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]"
        style={{
          borderColor: "var(--border-strong)",
          background: "var(--surface)",
          color: "var(--ink)",
        }}
      />
    </div>
  );
}

/** The glass, at the weight of the text beside it rather than the icon set's. */
function Glass() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.5 10.5L14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
