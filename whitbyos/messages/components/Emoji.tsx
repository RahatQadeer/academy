"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small emoji panel next to the paperclip.
 *
 * Deliberately a fixed, curated set rather than a picker library. The full
 * Unicode catalogue is a megabyte of data and a search box to go with it, and
 * what a conversation about a client's visa appointment actually needs is about
 * sixty characters — acknowledgement, agreement, apology, a date, a document.
 */
export const GROUPS: { label: string; emoji: string[] }[] = [
  {
    label: "Reactions",
    emoji: ["👍", "👎", "👌", "🙏", "🙌", "👏", "🤝", "❤️", "✅", "❌", "❗", "❓", "⭐", "🔥", "💯", "🎉"],
  },
  {
    label: "Faces",
    emoji: [
      "🙂", "😊", "😀", "😄", "😂", "🤣", "😅", "😉",
      "😌", "😍", "🥰", "😘", "🤗", "🤔", "😐", "😶",
      "🙄", "😏", "😕", "😟", "😢", "😭", "😮", "😱",
      "😴", "🥱", "😤", "😡", "🤒", "🤕", "🥳", "🤷",
    ],
  },
  {
    label: "Work",
    emoji: ["📅", "🕐", "📎", "📄", "📝", "📌", "✈️", "🏠", "🚗", "💼", "💳", "📞"],
  },
];

export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Clicking anywhere else closes it, which is what every other panel does.
  useEffect(() => {
    if (!open) return;

    function away(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

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
        aria-label="Insert an emoji"
        aria-expanded={open}
        title="Emoji"
        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[15px]"
        style={{ color: "var(--text-secondary)" }}
      >
        🙂
      </button>

      {open ? (
        <div
          className="absolute bottom-[38px] right-0 z-20 w-[268px] rounded-[10px] border border-line bg-surface p-2.5"
          style={{ boxShadow: "0 8px 24px rgba(15,15,15,.14)" }}
        >
          {GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <span
                className="mb-1 block px-1 text-[10.5px] font-semibold uppercase tracking-[.05em]"
                style={{ color: "var(--text-tertiary)" }}
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
                    className="flex h-8 items-center justify-center rounded-[6px] text-[17px] hover:bg-[var(--surface-soft)]"
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
