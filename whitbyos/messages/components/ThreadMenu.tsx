"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  href: string;
  /** A second line, for the one or two that need saying. */
  detail?: string;
  danger?: boolean;
};

/**
 * The ⋯ above a conversation.
 *
 * Add to Request, Create Task and settings sat across the top of every
 * conversation as bordered buttons — a toolbar over a chat. One mark now, and
 * everything that can be done to a conversation is behind it. Adding people
 * lives in Group settings, not as a second door beside it.
 *
 * Every item is a link: each one opens a panel this screen already draws at a
 * URL, so the menu holds no state of its own beyond being open, and Back works
 * through it.
 */
export function ThreadMenu({ items, label = "Conversation menu" }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-control border text-[17px] leading-none transition-colors hover:bg-[var(--surface-soft)]"
        style={{
          borderColor: "var(--chrome-line)",
          background: open ? "var(--surface-soft)" : "var(--surface)",
          color: "var(--ink)",
        }}
      >
        {"⋯"}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[236px] overflow-hidden rounded-[10px] border py-1"
          style={{
            borderColor: "var(--chrome-line)",
            background: "var(--surface)",
            boxShadow: "0 6px 28px -8px rgba(31,72,125,.28), 0 1px 3px rgba(31,72,125,.12)",
          }}
        >
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-[13px] no-underline transition-colors hover:bg-[var(--surface-soft)]"
              style={{ color: item.danger ? "var(--danger-text)" : "var(--ink)" }}
            >
              {item.label}
              {item.detail ? (
                <span
                  className="mt-0.5 block text-[11.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {item.detail}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
