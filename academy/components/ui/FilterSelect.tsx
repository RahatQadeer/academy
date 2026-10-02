"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/base/lib/cn";

export type FilterSelectOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type MenuBox = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  ready: boolean;
};

const EMPTY_MENU: MenuBox = { top: 0, left: 0, width: 0, maxHeight: 280, ready: false };

export function FilterSelect({
  label,
  value,
  options,
  disabled,
  onChange,
  tone = "filter",
  size = "sm",
  placeholder = "Select",
  hideLabel = false,
  className,
}: {
  label: string;
  value: string;
  options: FilterSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  tone?: "filter" | "field";
  size?: "xs" | "sm" | "md";
  placeholder?: string;
  hideLabel?: boolean;
  className?: string;
}) {
  const listId = useId();
  const buttonId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menu, setMenu] = useState<MenuBox>(EMPTY_MENU);
  const selectedIndex = useMemo(() => {
    const index = options.findIndex((option) => option.value === value);
    return index >= 0 ? index : 0;
  }, [options, value]);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  function computeMenu(): MenuBox | null {
    const button = buttonRef.current;
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const gutter = 8;
    const gap = 6;
    // Keep menus short — scroll inside instead of covering half the page.
    const preferredHeight = Math.min(200, Math.max(120, options.length * 34 + 8));
    const spaceBelow = window.innerHeight - rect.bottom - gutter;
    const spaceAbove = rect.top - gutter;
    const canOpenDown = spaceBelow >= 120;
    const openUp = !canOpenDown && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.min(preferredHeight, Math.max(120, available));
    const width = Math.max(rect.width, Math.min(260, window.innerWidth - gutter * 2));
    return {
      top: openUp ? Math.max(gutter, rect.top - maxHeight - gap) : rect.bottom + gap,
      left: Math.min(Math.max(gutter, rect.left), window.innerWidth - width - gutter),
      width,
      maxHeight,
      ready: true,
    };
  }

  function openMenu() {
    const next = computeMenu();
    if (next) setMenu(next);
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setMenu(EMPTY_MENU);
  }

  useLayoutEffect(() => {
    if (!open) return;

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

    function eventInList(target: EventTarget | null) {
      return target instanceof Node && Boolean(listRef.current?.contains(target));
    }

    /** Keep the page / settings pane still while the menu is open. */
    function onWheel(event: WheelEvent) {
      if (!eventInList(event.target)) {
        event.preventDefault();
        return;
      }
      const list = listRef.current;
      if (!list) return;
      const { scrollTop, scrollHeight, clientHeight } = list;
      const delta = event.deltaY;
      const atTop = scrollTop <= 0 && delta < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && delta > 0;
      if (scrollHeight <= clientHeight || atTop || atBottom) {
        event.preventDefault();
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (!eventInList(event.target)) {
        event.preventDefault();
      }
    }

    function onResize() {
      const next = computeMenu();
      if (!next) return;
      setMenu((prev) =>
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.maxHeight === next.maxHeight
          ? prev
          : next,
      );
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, selectedIndex, options.length]);

  function choose(option: FilterSelectOption) {
    if (option.disabled) return;
    closeMenu();
    if (option.value !== value) onChange(option.value);
  }

  function move(delta: number) {
    if (options.length === 0) return;
    let next = activeIndex;
    for (let step = 0; step < options.length; step += 1) {
      next = (next + delta + options.length) % options.length;
      if (!options[next]?.disabled) break;
    }
    setActiveIndex(next);
    window.requestAnimationFrame(() => {
      const list = listRef.current;
      const item = list?.querySelector<HTMLElement>(`[data-index="${next}"]`);
      if (list && item) scrollItemInList(list, item);
    });
  }

  const list = open && mounted && menu.ready
    ? createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
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
              move(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              move(-1);
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              const option = options[activeIndex];
              if (option) choose(option);
            } else if (event.key === "Home") {
              event.preventDefault();
              setActiveIndex(0);
            } else if (event.key === "End") {
              event.preventDefault();
              setActiveIndex(Math.max(0, options.length - 1));
            }
          }}
        >
          {options.map((option, index) => {
            const selectedOption = option.value === value;
            const active = index === activeIndex;
            return (
              <li key={option.value || `empty-${index}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  data-index={index}
                  aria-selected={selectedOption}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className="flex w-full min-w-0 items-start gap-2 px-3 py-2 text-left text-[13.5px] leading-snug disabled:opacity-40"
                  style={{
                    background: selectedOption
                      ? "var(--accent-tint, #f4f9fe)"
                      : active
                        ? "var(--surface-soft, #f7f7f5)"
                        : "transparent",
                    color: selectedOption ? "var(--accent-hover, #1a6bbd)" : "var(--ink)",
                  }}
                >
                  <span className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                    {selectedOption ? <CheckIcon /> : null}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{option.label}</span>
                  {option.hint ? (
                    <span
                      className="shrink-0 pt-[1px] text-[12px] tabular-nums"
                      style={{ color: selectedOption ? "var(--accent, #2383e2)" : "var(--text-tertiary)" }}
                    >
                      {option.hint}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className={cn("relative block min-w-0", className)}>
      {hideLabel ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span
          className={
            tone === "field"
              ? "mb-1.5 block text-[12.5px] font-medium"
              : size === "xs"
                ? "mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em]"
                : "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em]"
          }
          style={{ color: "var(--text-tertiary)" }}
        >
          {label}
        </span>
      )}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
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
          "flex w-full min-w-0 items-center gap-2 rounded-[8px] border bg-surface px-2.5 text-left text-ink outline-none transition-[border-color,box-shadow]",
          size === "md"
            ? tone === "field"
              ? "min-h-10 px-3 py-2 text-[14px]"
              : "h-10 px-3 text-[14px]"
            : size === "xs"
              ? "h-8 text-[12.5px]"
              : "h-9 px-3 text-[13.5px]",
          "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-accent" : "border-line-strong",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1",
            tone === "field" ? "whitespace-normal break-words leading-snug" : "truncate",
          )}
          style={{ color: selected ? "var(--ink)" : "var(--text-tertiary)" }}
        >
          {selected?.label ?? placeholder}
        </span>
        {selected?.hint ? (
          <span className="hidden shrink-0 tabular-nums sm:inline" style={{ color: "var(--text-tertiary)" }}>
            {selected.hint}
          </span>
        ) : null}
        <Chevron open={open} />
      </button>
      {list}
    </div>
  );
}

function scrollItemInList(list: HTMLElement, item: HTMLElement) {
  const listRect = list.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  if (itemRect.top < listRect.top) {
    list.scrollTop -= listRect.top - itemRect.top;
    return;
  }
  if (itemRect.bottom > listRect.bottom) {
    list.scrollTop += itemRect.bottom - listRect.bottom;
  }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className={cn("shrink-0 transition-transform", open && "rotate-180")}
      style={{ color: "var(--text-tertiary)" }}
    >
      <path
        d="M2.5 4L5 6.5L7.5 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
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
        d="M2.5 6.2 5 8.7 9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
