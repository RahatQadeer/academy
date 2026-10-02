"use client";

import { useId, useState } from "react";

export function AskComposer({
  threadId,
  placeholder,
  centered,
  busy,
  onSend,
}: {
  threadId?: string;
  placeholder: string;
  centered?: boolean;
  busy?: boolean;
  /** Parent runs the server action. `data` already has q (and image if any). */
  onSend?: (question: string, data: FormData) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [formKey, setFormKey] = useState(0);
  const imageId = useId();
  const canSend = !busy && (text.trim().length > 0 || Boolean(preview));

  function clear() {
    setText("");
    setPreview(null);
    setFormKey((n) => n + 1);
  }

  return (
    <form
      key={formKey}
      className={centered ? "ask-composer-hero mx-auto w-full" : "w-full"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSend || !onSend) return;
        const form = event.currentTarget;
        const q = text.trim() || "What is in this image?";
        const data = new FormData(form);
        data.set("q", q);
        clear();
        onSend(q, data);
      }}
    >
      {threadId ? <input type="hidden" name="thread_id" value={threadId} /> : null}
      {preview ? (
        <div className="mb-2 flex items-center gap-2 px-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="h-12 w-12 rounded-[8px] object-cover" />
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              const input = document.getElementById(imageId) as HTMLInputElement | null;
              if (input) input.value = "";
            }}
            className="text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Remove
          </button>
        </div>
      ) : null}
      <div className={`ask-box${busy ? " is-busy" : ""}`}>
        <label
          htmlFor={imageId}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-control hover:bg-[var(--canvas)]"
          style={{ color: "var(--text-secondary)" }}
          title="Add image"
        >
          <PlusIcon />
        </label>
        <input
          id={imageId}
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
        <textarea
          name="q"
          rows={1}
          value={text}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={busy}
          className="min-h-[24px] max-h-[140px] min-w-0 flex-1 resize-none border-none bg-transparent py-1.5 text-[15px] leading-[1.45] outline-none"
          onChange={(event) => {
            const box = event.currentTarget;
            setText(box.value);
            box.style.height = "auto";
            box.style.height = `${Math.min(box.scrollHeight, 140)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={!canSend} className="ask-send" aria-label="Send">
          <SendIcon />
        </button>
      </div>
    </form>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 12.5V3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M4.2 7.2 8 3.5l3.8 3.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
