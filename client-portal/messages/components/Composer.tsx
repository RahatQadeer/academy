"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { EmojiButton } from "./EmojiButton";

/** About five lines. Past that the box scrolls, so a long message never pushes
    the conversation it belongs to off the screen. */
const MAX_HEIGHT = 108;

export type ComposerHandle = {
  focus: () => void;
  /** Puts the words of a send that failed back in the box. */
  restore: (body: string) => void;
};

/**
 * The reply box.
 *
 * It owns what is being typed and nothing else. Sending is handed straight to
 * the conversation (`onSend`), which draws the message at once and talks to the
 * server underneath — so the box clears the instant Send is pressed, the way a
 * chat does, rather than holding a "Sending…" label until a round trip ends. A
 * send that fails puts its words back here (`restore`).
 *
 * Enter sends and Shift+Enter breaks the line — the same keys as Whitby's
 * composer. `isComposing` guards an IME, where Enter is choosing a character,
 * not finishing a sentence.
 *
 * There is no attachment control. A portal message is text: `sendMessage`
 * writes a body and nothing else, and the client has no upload path into
 * `whitbyos_message_attachments`. A paperclip that could not attach anything
 * would be the one thing on this screen that lies.
 */
export const Composer = forwardRef<
  ComposerHandle,
  {
    onSend: (body: string) => void;
    /** Who the reply goes to, for the placeholder. */
    recipient: string;
  }
>(function Composer({ onSend, recipient }, ref) {
  const [body, setBody] = useState("");
  const [focused, setFocused] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => box.current?.focus(),
    // Anything typed since the failed send is kept, after the words that failed.
    restore: (text) => {
      setBody((current) => (current.trim() ? `${text}\n${current}` : text));
      requestAnimationFrame(() => box.current?.focus());
    },
  }));

  // Grows with what is written, and shrinks back when it is sent.
  useEffect(() => {
    const field = box.current;
    if (!field) return;
    field.style.height = "0px";
    field.style.height = `${Math.min(field.scrollHeight, MAX_HEIGHT)}px`;
    field.style.overflowY = field.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [body]);

  const ready = body.trim().length > 0;

  function send() {
    if (!ready) return;
    onSend(body.trim());
    setBody("");
    box.current?.focus();
  }

  /** An emoji lands where the cursor is, not at the end of what is written. */
  function insert(emoji: string) {
    const field = box.current;
    const from = field?.selectionStart ?? body.length;
    const to = field?.selectionEnd ?? body.length;
    setBody(body.slice(0, from) + emoji + body.slice(to));

    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      field.setSelectionRange(from + emoji.length, from + emoji.length);
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {/* White, on a ground that is not — the paper you write on, as Whitby's
          composer draws it. */}
      <div
        className="flex items-end gap-2.5 rounded-[8px] border px-3 py-2.5 transition-[border-color,box-shadow] duration-200"
        style={{
          background: "var(--chat-field)",
          borderColor: focused
            ? "color-mix(in srgb, var(--accent) 45%, transparent)"
            : "var(--chat-line)",
          boxShadow: focused
            ? "0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)"
            : undefined,
        }}
      >
        <textarea
          ref={box}
          name="body"
          rows={1}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
              return;
            }
            event.preventDefault();
            send();
          }}
          placeholder="Type a message"
          aria-label={`Message ${recipient}`}
          aria-describedby="cp-composer-keys"
          className="cp-chat-scroll min-w-0 flex-1 resize-none self-center border-none bg-transparent py-1 text-[15px] leading-[1.5] outline-none sm:text-[13.5px]"
          style={{ color: "var(--chat-ink)", maxHeight: MAX_HEIGHT }}
        />

        <span id="cp-composer-keys" className="sr-only">
          Enter sends. Shift and Enter starts a new line.
        </span>

        <EmojiButton onPick={insert} />

        {/* The product's blue, always — faded until there is a message, so it
            says whether pressing it will do anything before it is pressed. */}
        <button
          type="submit"
          disabled={!ready}
          aria-label="Send message"
          title={ready ? "Send" : "Nothing to send yet"}
          className="cp-press flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white disabled:cursor-default"
          style={{ background: "var(--accent)", opacity: ready ? 1 : 0.4 }}
        >
          <SendArrow />
        </button>
      </div>
    </form>
  );
});

/** The arrow a chat sends with — Whitby's paper plane. */
function SendArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 13.5L14 8L2.5 2.5L2.5 6.9L10 8L2.5 9.1L2.5 13.5Z" fill="currentColor" />
    </svg>
  );
}
