"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  href: string;
  /** A second line, for the one or two that need saying. */
  detail?: string;
};

/**
 * The ⋯ above a conversation — Whitby's `ThreadMenu`, drawn the same way.
 *
 * Everything that can be done to a conversation from here sits behind one mark
 * instead of a row of buttons over the chat. Every item is a link, so the menu
 * holds no state beyond being open, and Back works through it.
 */
export function ThreadMenu({
  items,
  label = "Conversation menu",
}: {
  items: MenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="cp-press flex h-[34px] w-[34px] items-center justify-center rounded-control border text-[17px] leading-none hover:bg-[var(--surface-active)]"
        style={{
          borderColor: "var(--chat-line)",
          background: open ? "var(--surface-active)" : "var(--chat-field)",
          color: "var(--ink)",
        }}
      >
        {"⋯"}
      </button>

      {open ? (
        <div
          role="menu"
          className="cp-fade-up absolute right-0 top-[calc(100%+6px)] z-30 w-[236px] overflow-hidden rounded-[10px] border py-1"
          style={{
            borderColor: "var(--chat-line)",
            background: "var(--chat-field)",
            boxShadow: "0 6px 28px -8px rgb(var(--shade-rgb) / .28), 0 1px 3px rgb(var(--shade-rgb) / .12)",
          }}
        >
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3.5 py-2 text-[13px] no-underline transition-colors hover:bg-[var(--surface-active)]"
              style={{ color: "var(--ink)" }}
            >
              {item.label}
              {item.detail ? (
                <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
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
