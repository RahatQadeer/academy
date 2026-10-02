"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search inside the open conversation, from the header.
 *
 * Where a chat keeps it — beside the menu, over the conversation it searches,
 * rather than inside the transcript it is filtering. Closed it is a glass;
 * open it is a field, and the word travels in the URL the way the rail's own
 * search does, so it survives a refresh and can be linked to.
 *
 * Debounced, because every replacement re-runs the page.
 */
export function ConversationSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("find") ?? "";

  const [open, setOpen] = useState(current.length > 0);
  const [value, setValue] = useState(current);
  const box = useRef<HTMLInputElement>(null);

  // A different conversation, or someone arriving on a link that carries one.
  useEffect(() => {
    setValue(current);
    if (current) setOpen(true);
  }, [current]);

  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);

  useEffect(() => {
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("find", value.trim());
      else next.delete("find");
      // Looking through a conversation is not a place to press Back through.
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 250);

    return () => clearTimeout(timer);
  }, [value, current, params, pathname, router]);

  function close() {
    setValue("");
    setOpen(false);

    if (!current) return;
    const next = new URLSearchParams(params.toString());
    next.delete("find");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search in this conversation"
        title="Search in this conversation"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-line transition-colors hover:bg-[var(--surface-active)]"
        style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
      >
        <Glass />
      </button>
    );
  }

  return (
    <label
      className="flex w-[230px] shrink-0 items-center gap-2 rounded-full border px-3 py-[6px]"
      style={{ background: "var(--surface-soft)", borderColor: "var(--border-strong)" }}
    >
      <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>
        <Glass />
      </span>

      <input
        ref={box}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        placeholder="Search in this chat"
        aria-label="Search in this conversation"
        className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] outline-none"
        style={{ color: "var(--ink)" }}
      />

      <button
        type="button"
        onClick={close}
        aria-label="Close search"
        title="Close search"
        className="shrink-0 text-[14px] leading-none"
        style={{ color: "var(--text-tertiary)" }}
      >
        ×
      </button>
    </label>
  );
}

function Glass() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.6 10.6 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
