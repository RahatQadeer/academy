"use client";

import { useEffect, useId, useRef, useState } from "react";

export function PageHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label="About this page"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--accent-tint)]"
        style={{
          color: "var(--accent)",
          boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent) 28%, var(--chrome-line))",
          background: open ? "var(--accent-tint)" : "var(--surface)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.35" />
          <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
          <circle cx="8" cy="5.2" r="0.85" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div
          id={id}
          role="note"
          className="absolute left-0 z-20 mt-2 w-[min(280px,calc(100vw-4rem))] rounded-[12px] border bg-surface p-3.5 text-[12.5px] leading-[1.55]"
          style={{
            borderColor: "var(--chrome-line)",
            color: "var(--text-secondary)",
            boxShadow: "0 16px 40px -24px rgba(15,32,56,.45)",
          }}
        >
          {text}
        </div>
      ) : null}
    </div>
  );
}
