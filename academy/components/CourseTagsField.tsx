"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/base/lib/cn";
import { COURSE_TAG_MAX, COURSE_TAG_MIN } from "@/academy/lib/courseTags/constants";
import type { CourseTag } from "@/academy/lib/courseTags/types";

type MenuBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  ready: boolean;
};

const EMPTY_MENU: MenuBox = { top: 0, left: 0, width: 0, maxHeight: 280, ready: false };

export function CourseTagsField({
  tags,
  value,
  disabled,
  onChange,
  error,
  compact = false,
  hideLabel = false,
}: {
  tags: CourseTag[];
  value: string[];
  disabled?: boolean;
  onChange: (tagIds: string[]) => void;
  error?: string | null;
  /** Same control chrome as Length / Level / Type. */
  compact?: boolean;
  /** Parent already shows a section title. */
  hideLabel?: boolean;
}) {
  const listId = useId();
  const buttonId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menu, setMenu] = useState<MenuBox>(EMPTY_MENU);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = useMemo(() => {
    const byId = new Map(tags.map((tag) => [tag.id, tag]));
    return value.map((id) => byId.get(id)).filter((tag): tag is CourseTag => Boolean(tag));
  }, [tags, value]);

  const options = useMemo(
    () => tags.filter((tag) => !tag.archivedAt),
    [tags],
  );

  const filteredOptions = useMemo(() => {
    if (!compact) {
      const needle = query.trim().toLowerCase();
      const selectedSet = new Set(value);
      return options.filter((tag) => {
        if (selectedSet.has(tag.id)) return false;
        if (!needle) return true;
        return tag.name.toLowerCase().includes(needle);
      });
    }
    return options;
  }, [compact, options, query, value]);

  const atMax = value.length >= COURSE_TAG_MAX;
  const selectedSet = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    setMounted(true);
  }, []);

  function computeMenu(): MenuBox | null {
    const button = buttonRef.current;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const gutter = 8;
    const gap = 6;
    // Prefer opening down into the page (catalog), not up over the prompt.
    const preferredHeight = Math.min(200, Math.max(140, options.length * 34 + 8));
    const spaceBelow = window.innerHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const canOpenDown = spaceBelow >= 120;
    const openUp = !canOpenDown && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(preferredHeight, Math.max(120, available));
    const width = Math.max(rect.width, Math.min(240, window.innerWidth - gutter * 2));
    return {
      top: openUp ? Math.max(gutter, rect.top - maxHeight - gap) : rect.bottom + gap,
      left: Math.min(Math.max(gutter, rect.left), window.innerWidth - width - gutter),
      width,
      maxHeight,
      ready: true,
    };
  }

  function closeMenu() {
    setOpen(false);
    setMenu(EMPTY_MENU);
  }

  function openMenu() {
    if (disabled) return;
    const next = computeMenu();
    if (next) setMenu(next);
    setActiveIndex(0);
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !compact) return;

    const frame = window.requestAnimationFrame(() => {
      listRef.current?.focus({ preventScroll: true });
    });

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      closeMenu();
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        buttonRef.current?.focus({ preventScroll: true });
      }
    }

    function onResize() {
      const next = computeMenu();
      if (next) setMenu(next);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, compact, options.length]);

  useEffect(() => {
    if (!open || compact) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, compact]);

  function toggleTag(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    if (atMax) return;
    const next = [...value, id];
    onChange(next);
    if (next.length >= COURSE_TAG_MAX) closeMenu();
  }

  function removeTag(id: string) {
    if (disabled) return;
    onChange(value.filter((item) => item !== id));
  }

  function addTag(id: string) {
    if (disabled || atMax || value.includes(id)) return;
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
  }

  if (compact) {
    const summary =
      selected.length === 0
        ? "Select"
        : selected.length === 1
          ? selected[0]!.name
          : `${selected.length} selected`;

    const list =
      open && mounted && menu.ready
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={buttonId}
              aria-multiselectable="true"
              tabIndex={-1}
              className="overflow-y-auto overscroll-contain rounded-[10px] border bg-surface py-1"
              style={{
                position: "fixed",
                top: menu.top,
                left: menu.left,
                width: menu.width,
                maxHeight: menu.maxHeight,
                zIndex: 1200,
                borderColor: "var(--border-strong)",
                boxShadow: "0 12px 40px rgba(15,15,15,.12), 0 1px 3px rgba(15,15,15,.08)",
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((i) => Math.min(options.length - 1, i + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((i) => Math.max(0, i - 1));
                } else if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  const option = options[activeIndex];
                  if (option) toggleTag(option.id);
                }
              }}
            >
              {options.map((tag, index) => {
                const isSelected = selectedSet.has(tag.id);
                const active = index === activeIndex;
                const blocked = !isSelected && atMax;
                return (
                  <li key={tag.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={blocked}
                      data-index={index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => toggleTag(tag.id)}
                      className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left text-[13.5px] leading-snug disabled:opacity-40"
                      style={{
                        background: isSelected
                          ? "var(--accent-tint, #f4f9fe)"
                          : active
                            ? "var(--surface-soft, #f7f7f5)"
                            : "transparent",
                        color: isSelected ? "var(--accent-hover, #1a6bbd)" : "var(--ink)",
                      }}
                    >
                      <span
                        className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center"
                        aria-hidden
                      >
                        {isSelected ? <CheckIcon /> : null}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{tag.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null;

    return (
      <div ref={rootRef} className="relative block min-w-0">
        <span
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Tags
        </span>
        <button
          ref={buttonRef}
          id={buttonId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label="Tags"
          onClick={() => {
            if (disabled) return;
            if (open) closeMenu();
            else openMenu();
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!open) openMenu();
            }
          }}
          className={cn(
            "flex h-8 w-full min-w-0 items-center gap-2 rounded-[8px] border bg-surface px-2.5 text-left text-[12.5px] text-ink outline-none transition-[border-color,box-shadow]",
            "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            open ? "border-accent" : "border-line-strong",
          )}
          title={
            selected.length
              ? selected.map((tag) => tag.name).join(", ")
              : `Pick ${COURSE_TAG_MIN === COURSE_TAG_MAX ? COURSE_TAG_MAX : `${COURSE_TAG_MIN}–${COURSE_TAG_MAX}`} tags`
          }
        >
          <span
            className="min-w-0 flex-1 truncate"
            style={{ color: selected.length ? "var(--ink)" : "var(--text-tertiary)" }}
          >
            {summary}
          </span>
          <Chevron open={open} />
        </button>
        {list}
        {error ? (
          <p className="mt-1 text-[11px]" style={{ color: "var(--warning-fg)" }}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const remaining = Math.max(0, COURSE_TAG_MIN - value.length);
  const tagHint =
    COURSE_TAG_MIN === COURSE_TAG_MAX
      ? `Pick ${COURSE_TAG_MAX} tags`
      : `Pick ${COURSE_TAG_MIN}–${COURSE_TAG_MAX} tags`;

  return (
    <div ref={rootRef} className="block min-w-0">
      {!hideLabel ? (
        <span
          className="mb-1.5 block text-[12.5px] font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          Course tags
        </span>
      ) : null}

      {selected.length > 0 ? (
        <ul className="mb-2.5 flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeTag(tag.id)}
                className="inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12.5px] font-medium transition-opacity disabled:opacity-50"
                style={{
                  background: "var(--module-academy-bg, var(--accent-tint))",
                  color: "var(--module-academy-fg, var(--accent-hover))",
                  border: "1px solid color-mix(in srgb, var(--module-academy-fg, var(--accent)) 18%, var(--border))",
                }}
                title="Remove tag"
              >
                {tag.name}
                <span aria-hidden className="text-[13px] leading-none opacity-60">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <input
          type="search"
          value={query}
          disabled={disabled || atMax}
          placeholder={atMax ? "All 3 tags selected" : "Search tags…"}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full rounded-[8px] border bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(35,131,226,.10)] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ borderColor: "var(--border-strong)" }}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={tagHint}
        />

        {open && !atMax && !disabled ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-[10px] border bg-surface py-1"
            style={{
              borderColor: "var(--border-strong)",
              boxShadow: "0 12px 40px rgba(15,15,15,.12), 0 1px 3px rgba(15,15,15,.08)",
            }}
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                No matching tags
              </li>
            ) : (
              filteredOptions.map((tag) => (
                <li key={tag.id} role="option">
                  <button
                    type="button"
                    className={cn(
                      "block w-full cursor-pointer px-3 py-2 text-left text-[13.5px] font-medium hover:bg-[var(--surface-soft)]",
                    )}
                    style={{ color: "var(--ink)", background: "transparent", border: "none" }}
                    onClick={() => addTag(tag.id)}
                  >
                    {tag.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--warning-fg)" }}>
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {value.length >= COURSE_TAG_MIN
            ? `${value.length}/${COURSE_TAG_MAX} selected`
            : remaining === COURSE_TAG_MIN
              ? `Select ${COURSE_TAG_MIN} tags`
              : `${value.length}/${COURSE_TAG_MAX} · ${remaining} more needed`}
        </p>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="shrink-0"
      style={{
        color: "var(--text-tertiary)",
        transform: open ? "rotate(180deg)" : undefined,
        transition: "transform 120ms ease",
      }}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
