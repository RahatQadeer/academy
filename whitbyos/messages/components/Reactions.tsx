"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { cn } from "@/base/lib/cn";
import type { Reaction } from "@/whitbyos/lib/messages";
import { toggleReaction } from "@/whitbyos/messages/actions";
import { GROUPS } from "@/whitbyos/messages/components/Emoji";

/**
 * The handful worth offering, in the order people reach for them.
 *
 * The composer has the full panel for when a reaction is really a message.
 * This is the other thing — the tap that says "seen, nothing to add", which
 * is worth exactly one row and no scrolling.
 */
const QUICK = ["👍", "🙏", "✅", "❤️", "😊", "😮"];

/**
 * What has been put on one message, under it.
 *
 * Each emoji once with its count, and yours drawn in the accent so the row
 * says which of them you are part of. Tapping one you are in takes it off —
 * there is no separate way to undo a reaction, because a reaction is a thing
 * you are either doing or not.
 */
export function ReactionRow({
  messageId,
  reactions,
  mine,
}: {
  messageId: string;
  reactions: Reaction[];
  /** Whether the message is yours, so the row sits under the right edge. */
  mine: boolean;
}) {
  const [pending, start] = useTransition();

  /* The tap lands before the server answers — a reaction that waits a round
     trip to appear feels broken in a way a message does not. */
  const [shown, show] = useOptimistic(reactions, (current, emoji: string) => {
    const found = current.find((one) => one.emoji === emoji);

    if (!found) {
      return [...current, { emoji, count: 1, mine: true, names: ["You"] }];
    }

    return current
      .map((one) =>
        one.emoji === emoji
          ? {
              ...one,
              count: one.count + (one.mine ? -1 : 1),
              mine: !one.mine,
              names: one.mine
                ? one.names.filter((name) => name !== "You")
                : [...one.names, "You"],
            }
          : one,
      )
      .filter((one) => one.count > 0);
  });

  if (shown.length === 0) return null;

  function put(emoji: string) {
    start(async () => {
      show(emoji);
      const data = new FormData();
      data.set("message_id", messageId);
      data.set("emoji", emoji);
      await toggleReaction(data);
    });
  }

  return (
    <div
      className={cn(
        "mt-[3px] flex flex-wrap gap-1",
        mine ? "justify-end pr-1" : "pl-8",
        pending && "opacity-80",
      )}
    >
      {shown.map((one) => (
        <button
          key={one.emoji}
          type="button"
          onClick={() => put(one.emoji)}
          title={one.names.join(", ")}
          aria-pressed={one.mine}
          className="flex items-center gap-1 rounded-full border px-[7px] py-[2px] text-[11.5px] leading-none transition-colors"
          style={{
            borderColor: one.mine ? "var(--accent)" : "var(--chat-line)",
            background: one.mine ? "var(--accent-tint)" : "var(--surface)",
            color: one.mine ? "var(--accent)" : "var(--chat-muted)",
          }}
        >
          <span className="text-[12.5px] leading-none">{one.emoji}</span>
          {one.count > 1 ? <span className="font-semibold tabular-nums">{one.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * The two things you can do to somebody else's line: answer it, or react.
 *
 * Shown on hover beside the bubble, the way a chat does it — a row that
 * carries its controls all the time is a row of buttons with a message in it.
 */
export function MessageActions({
  messageId,
  onReply,
  mine,
}: {
  messageId: string;
  onReply: () => void;
  mine: boolean;
}) {
  const [open, setOpen] = useState(false);
  /** The six are what people reach for; this is the rest of them. */
  const [all, setAll] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (!open) return;

    function away(event: MouseEvent) {
      if (box.current?.contains(event.target as Node)) return;
      setOpen(false);
      setAll(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (all) {
        setAll(false);
        return;
      }
      setOpen(false);
    }

    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open, all]);

  function put(emoji: string) {
    setOpen(false);
    setAll(false);
    start(async () => {
      const data = new FormData();
      data.set("message_id", messageId);
      data.set("emoji", emoji);
      await toggleReaction(data);
    });
  }

  return (
    <div
      ref={box}
      className={cn(
        "relative flex shrink-0 items-center gap-0.5 self-center transition-opacity",
        // Until the pointer is on the message, or the panel is open over it.
        open ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
      )}
    >
      <Round label="Reply" onClick={onReply}>
        <ReplyArrow />
      </Round>
      <Round
        label="React"
        onClick={() => {
          setOpen((was) => !was);
          setAll(false);
        }}
      >
        <span className="text-[13px] leading-none">🙂</span>
      </Round>

      {open && !all ? (
        <div
          className={cn(
            "absolute bottom-[26px] z-20 flex items-center gap-0.5 rounded-full border border-line bg-surface px-1.5 py-1",
            mine ? "right-0" : "left-0",
          )}
          style={{ boxShadow: "0 6px 20px rgba(15,15,15,.14)" }}
        >
          {QUICK.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => put(emoji)}
              aria-label={`React ${emoji}`}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] leading-none transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}

          {/* And anything else. Six covers most of it and nothing covers all
              of it, so the rest is one tap away rather than unavailable. */}
          <button
            type="button"
            onClick={() => setAll(true)}
            aria-label="More reactions"
            title="More"
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-line text-[15px] leading-none transition-colors hover:bg-[var(--surface-active)]"
            style={{ color: "var(--chat-muted)" }}
          >
            +
          </button>
        </div>
      ) : null}

      {open && all ? (
        <div
          className={cn(
            "absolute bottom-[26px] z-20 w-[268px] rounded-[10px] border border-line bg-surface p-2.5",
            mine ? "right-0" : "left-0",
          )}
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
                    onClick={() => put(emoji)}
                    aria-label={`React ${emoji}`}
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

function Round({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line transition-colors hover:bg-[var(--surface-active)]"
      style={{ background: "var(--surface)", color: "var(--chat-muted)" }}
    >
      {children}
    </button>
  );
}

/** The hook every chat answers with. */
function ReplyArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M7 3.5L2.5 7.5L7 11.5V9C10 9 12 10 13 13C13.2 9 11.5 6 7 6V3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
