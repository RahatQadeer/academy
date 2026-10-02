"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/base/lib/cn";
import { pcType } from "@/partner-center/lib/typography";

function SendArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 13.5L14 8L2.5 2.5L2.5 6.9L10 8L2.5 9.1L2.5 13.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Whitby-inspired composer chrome — Partner Center owned, text-only. */
export function PartnerComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  error?: string | null;
}) {
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(value.trim().length > 0);
  }, [value]);

  useEffect(() => {
    const box = bodyInput.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 108)}px`;
  }, [value]);

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit();
  }

  return (
    <div className="border-t border-line px-7 py-4">
      {error ? (
        <p
          className={cn("mb-3", pcType.subtitle)}
          style={{ color: "var(--danger-fg)" }}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.trim() || disabled) return;
          onSubmit();
        }}
      >
        <div
          className="flex items-end gap-2.5 rounded-[8px] border px-3 py-2.5"
          style={{ background: "var(--chat-field)", borderColor: "var(--chat-line)" }}
        >
          <textarea
            ref={bodyInput}
            name="body"
            rows={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message"
            disabled={disabled}
            className={cn(
              "min-w-0 flex-1 resize-none border-none bg-transparent py-1 leading-[1.5] outline-none",
              pcType.body,
            )}
            style={{ color: "var(--chat-ink)" }}
          />
          <button
            type="submit"
            disabled={!ready || disabled}
            aria-label="Send"
            title={ready ? "Send" : "Nothing to send yet"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity"
            style={{
              background: "var(--accent)",
              opacity: ready && !disabled ? 1 : 0.4,
            }}
          >
            <SendArrow />
          </button>
        </div>
      </form>
    </div>
  );
}
