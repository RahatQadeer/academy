"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/base/lib/cn";

/**
 * A small emoji panel in the composer.
 *
 * Nothing but text: an emoji is a character in the message, so this adds no
 * behaviour the portal did not already have, only a way to type one without a
 * system picker. The set is Whitby's (`whitbyos/messages/components/Emoji.tsx`)
 * so the two sides of a conversation offer the same sixty characters —
 * acknowledgement, agreement, a date, a document — rather than a megabyte of
 * Unicode catalogue.
 */
const GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Reactions",
    emoji: ["👍", "👌", "🙏", "🙌", "👏", "🤝", "✅", "❌", "❗", "❓", "⭐", "🔥"],
  },
  {
    label: "Faces",
    emoji: ["🙂", "😊", "😀", "😅", "😉", "😌", "🤔", "😐", "😕", "😞", "😍", "🥳"],
  },
  {
    label: "Work",
    emoji: ["📅", "🕐", "📎", "📄", "📝", "📌", "✈️", "🏠", "🚗", "💼", "💳", "📞"],
  },
];

export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Anywhere else closes it, and Escape hands focus back to the button that
  // opened it rather than dropping it on the page.
  useEffect(() => {
    if (!open) return;

    function away(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }

    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-label="Insert an emoji"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "cp-press flex h-8 w-8 items-center justify-center rounded-[6px]",
          open ? "bg-[var(--surface-active)]" : "hover:bg-[var(--surface-active)]",
        )}
        style={{ color: open ? "var(--accent)" : "var(--chat-muted)" }}
      >
        <SmileIcon />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Emoji"
          className="cp-pop absolute bottom-[calc(100%+14px)] right-0 z-30 w-[min(284px,calc(100vw-48px))] rounded-[14px] border p-2.5"
          style={{
            // It sits at the right of the composer now, beside Send.
            transformOrigin: "100% 100%",
            background: "var(--chat-field)",
            borderColor: "var(--chat-line)",
            boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .08), 0 16px 40px -12px rgb(var(--shade-rgb) / .28)",
          }}
        >
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <span
                className="mb-1 block px-1.5 text-[10.5px] font-semibold uppercase tracking-[.06em]"
                style={{ color: "var(--chat-faint)" }}
              >
                {group.label}
              </span>
              <div className="grid grid-cols-6 gap-0.5">
                {group.emoji.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onPick(emoji);
                      setOpen(false);
                    }}
                    aria-label={emoji}
                    className="cp-press flex h-9 items-center justify-center rounded-[9px] text-[19px] hover:bg-[var(--surface-active)] focus-visible:bg-[var(--surface-active)] focus-visible:outline-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SmileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M7.1 11.7c.7.95 1.7 1.45 2.9 1.45s2.2-.5 2.9-1.45"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7.6" cy="8.3" r="1" fill="currentColor" />
      <circle cx="12.4" cy="8.3" r="1" fill="currentColor" />
    </svg>
  );
}
