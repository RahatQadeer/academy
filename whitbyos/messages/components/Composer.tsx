"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmojiButton } from "@/whitbyos/messages/components/Emoji";
import type { Quoted } from "@/whitbyos/lib/messages";
import { discardDraft, saveDraft } from "@/whitbyos/messages/actions";

/**
 * The composer, as the export draws it — one line inside a bordered box, the
 * person's name in the placeholder — plus the two things it leaves out.
 *
 * A draft is not something you ask for. Type a reply, walk away without sending
 * it, and it is still there when you come back; that is what the Drafts filter
 * in 9.0c counts. So the box saves itself as it goes, and the only explicit
 * control is the one that throws the draft away.
 *
 * The paperclip sits to the left of Send. Nothing is uploaded until the message
 * is sent, so picking the wrong file costs nothing.
 */
export function Composer({
  threadId,
  draft,
  draftId,
  action,
  answering,
  onStopAnswering,
}: {
  threadId: string;
  /** What was left in the box last time, if anything. */
  draft: string;
  /**
   * The row that draft is stored on.
   *
   * A conversation is read from several threads, so the unsent message in the
   * box does not always belong to the thread the box writes to — and every
   * action that touches it has to be told which row it is, or it deletes
   * nothing and the rail goes on saying "Draft:".
   */
  draftId?: string | null;
  /** The message this reply answers, quoted over the box until it is sent. */
  answering?: Quoted | null;
  onStopAnswering?: () => void;
  /**
   * What sending does. Supplied by the conversation rather than called
   * directly, so the same submit that reaches the server also puts the
   * message on screen — an optimistic update only counts if it happens in
   * the transition the action starts.
   */
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [body, setBody] = useState(draft);
  const [files, setFiles] = useState<File[]>([]);
  const [saved, setSaved] = useState(draft.length > 0);

  const fileInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // What is already on the server, so an unchanged box never writes.
  const stored = useRef(draft);

  useEffect(() => {
    if (body === stored.current) return;

    const timer = setTimeout(() => {
      stored.current = body;
      setSaved(body.trim().length > 0);
      void saveDraft(threadId, body, draftId ?? null);
    }, 800);

    return () => clearTimeout(timer);
  }, [body, threadId, draftId]);

  /* Answering something puts the cursor in the box: the tap was on the
     message, and what happens next is typing. */
  useEffect(() => {
    if (answering) bodyInput.current?.focus();
  }, [answering]);

  /** Emoji land where the cursor is, not at the end of whatever is written. */
  function insertEmoji(emoji: string) {
    const box = bodyInput.current;
    if (!box) {
      setBody((current) => current + emoji);
      return;
    }

    const from = box.selectionStart ?? body.length;
    const to = box.selectionEnd ?? body.length;
    setBody(body.slice(0, from) + emoji + body.slice(to));

    requestAnimationFrame(() => {
      box.focus();
      box.setSelectionRange(from + emoji.length, from + emoji.length);
    });
  }

  // One object URL per file, made once and released when the file goes —
  // building them during render would mint a new one on every keystroke and
  // never let go of the last.
  const previews = useMemo(() => {
    const map = new Map<string, string>();
    for (const file of files) {
      if (file.type.startsWith("image/")) map.set(file.name, URL.createObjectURL(file));
    }
    return map;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const url of previews.values()) URL.revokeObjectURL(url);
    };
  }, [previews]);

  /**
   * The box grows with what is written, to a ceiling of about five lines.
   * Past that it scrolls, so a long message never pushes the conversation off
   * the screen it belongs to.
   */
  useEffect(() => {
    const box = bodyInput.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 108)}px`;
  }, [body]);

  /**
   * Enter sends, Shift+Enter breaks the line — the arrangement every chat
   * uses, and the reason the box can afford to be more than one line.
   *
   * `isComposing` guards an IME: mid-composition Enter is choosing a
   * character, not finishing a sentence.
   */
  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!body.trim() && files.length === 0) return;
    formRef.current?.requestSubmit();
  }

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
  }

  function drop(name: string) {
    const kept = files.filter((file) => file.name !== name);
    setFiles(kept);

    // The input is what actually submits, so it has to lose the file too.
    if (fileInput.current) {
      const box = new DataTransfer();
      for (const file of kept) box.items.add(file);
      fileInput.current.files = box.files;
    }
  }

  const ready = body.trim().length > 0 || files.length > 0;

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-2"
      onSubmit={() => {
        /*
         * Emptied on the submit event, not in the action.
         *
         * A state change inside an action belongs to the transition the
         * action is running in, so nothing moves until the server answers —
         * and the reply you had just sent sat over the box the whole time it
         * was in flight, looking like it had not been sent at all. The form
         * data is already collected by the time this runs.
         */
        stored.current = "";
        setBody("");
        setFiles([]);
        setSaved(false);
        onStopAnswering?.();
      }}
    >
      <input type="hidden" name="thread_id" value={threadId} />
      {draftId ? <input type="hidden" name="draft_id" value={draftId} /> : null}
      {answering ? <input type="hidden" name="reply_to" value={answering.id} /> : null}

      {/* What is being answered, over the box — the same quote that will sit
          in the bubble, so nothing about the reply is a surprise once sent. */}
      {answering ? (
        <div
          className="flex items-start gap-2 rounded-[8px] border-l-[3px] px-2.5 py-1.5"
          style={{ borderColor: "var(--accent)", background: "var(--chat-panel)" }}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold" style={{ color: "var(--accent)" }}>
              Replying to {answering.mine ? "yourself" : answering.senderName}
            </div>
            <div
              className="line-clamp-2 text-[12.5px] leading-[1.45]"
              style={{ color: "var(--chat-muted)" }}
            >
              {answering.body ||
                (answering.attachmentCount > 0 ? "📎 Attachment" : "Message")}
            </div>
          </div>

          <button
            type="button"
            onClick={onStopAnswering}
            aria-label="Stop replying to this message"
            title="Stop replying"
            className="shrink-0 text-[15px] leading-none"
            style={{ color: "var(--chat-faint)" }}
          >
            ×
          </button>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((file) =>
            previews.has(file.name) ? (
              <span key={file.name} className="relative">
                {/* Local preview only — nothing has been uploaded yet. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previews.get(file.name)}
                  alt={file.name}
                  className="h-[62px] w-[62px] rounded-[8px] border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => drop(file.name)}
                  aria-label={`Remove ${file.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] leading-none text-white"
                  style={{ background: "rgba(15,15,15,.65)" }}
                >
                  ×
                </button>
              </span>
            ) : (
              <span
                key={file.name}
                className="flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-[12px]"
                style={{ background: "var(--chat-field)", color: "var(--chat-muted)" }}
              >
                {file.name}
                <button
                  type="button"
                  onClick={() => drop(file.name)}
                  aria-label={`Remove ${file.name}`}
                  style={{ color: "var(--chat-faint)" }}
                >
                  ×
                </button>
              </span>
            ),
          )}
        </div>
      ) : null}

      {/* White, on a ground that is not. Every other field in the product is
          white on white and needs its border to exist at all; this one is the
          paper you write on. */}
      <div
        className="flex items-end gap-2.5 rounded-[8px] border px-3 py-2.5"
        style={{ background: "var(--chat-field)", borderColor: "var(--chat-line)" }}
      >
        <textarea
          ref={bodyInput}
          name="body"
          rows={1}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message"
          className="min-w-0 flex-1 resize-none border-none bg-transparent py-1 text-[13.5px] leading-[1.5] outline-none"
        />

        <input
          ref={fileInput}
          type="file"
          name="files"
          multiple
          onChange={pick}
          className="hidden"
          id="message-files"
        />
        <EmojiButton onPick={insertEmoji} />

        <label
          htmlFor="message-files"
          title="Attach a file or an image"
          aria-label="Attach a file or an image"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-[15px]"
          style={{ color: "var(--chat-muted)" }}
        >
          📎
        </label>

        {/* The product's blue, always — it is the one button on the screen
            and a grey disc reads as something switched off rather than as
            something waiting. Faded until there is a message, so it still says
            whether pressing it will do anything before it is pressed. */}
        <button
          type="submit"
          disabled={!ready}
          aria-label="Send"
          title={ready ? "Send" : "Nothing to send yet"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity"
          style={{ background: "var(--accent)", opacity: ready ? 1 : 0.4 }}
        >
          <SendArrow />
        </button>
      </div>

      {/* 18-drafts labels the unsent message "Draft — not sent" and puts
          Discard and Send under it. The draft sits in the composer here rather
          than as a bubble in the thread, because that is where it is editable
          and two copies of the same unsent words would be worse than one; the
          words on the label are the reference's. */}
      {saved ? (
        <div className="flex items-center gap-3 text-[11.5px]" style={{ color: "var(--chat-muted)" }}>
          <span>Draft, not sent</span>
          <button
            type="submit"
            formAction={discardDraft}
            formNoValidate
            className="font-medium"
            style={{ color: "var(--chat-danger)" }}
          >
            Discard
          </button>
        </div>
      ) : null}
    </form>
  );
}

/** The arrow a chat sends with. */
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
