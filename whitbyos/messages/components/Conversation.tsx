"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";
import { Callout } from "@/base/components/Callout";
import { cn } from "@/base/lib/cn";
import { initialsOf } from "@/whitbyos/lib/contact-vocab";
import { deliveryLabel } from "@/whitbyos/lib/message-status";
import type { MessageRow, Quoted, ThreadKind } from "@/whitbyos/lib/messages";
import { sendMessage } from "@/whitbyos/messages/actions";
import { Composer } from "@/whitbyos/messages/components/Composer";
import { MessageActions, ReactionRow } from "@/whitbyos/messages/components/Reactions";
import { ScrollToLatest } from "@/whitbyos/messages/components/ScrollToLatest";
import { clockTime, dayLabel, dayOf, fileSize } from "@/whitbyos/messages/components/format";

/** A message on screen that the server has not confirmed yet. */
type Shown = MessageRow & { pending?: boolean };

/**
 * The open conversation — its messages and the box under them.
 *
 * Both live in one client component so that a sent message can appear the
 * instant it is sent. Before, pressing Enter waited on six queries and a full
 * server render before anything moved, which read as the app having missed the
 * keystroke. Now the bubble is drawn immediately, saying "Sending…" under it,
 * and the server catches up underneath — which is what every chat
 * does, and the reason they feel instant on connections that are not.
 *
 * The optimistic message is discarded automatically when the action settles;
 * React replaces it with whatever the server actually stored, so a send that
 * failed leaves nothing behind pretending it worked.
 */
export function Conversation({
  threadId,
  threadKind,
  messages,
  myName,
  myPhoto,
  draft,
  draftId,
  find,
  error,
  othersReadAt,
  readers,
}: {
  threadId: string;
  threadKind: ThreadKind;
  messages: MessageRow[];
  myName: string;
  /** Your own face, for the bubble drawn before the server has the message. */
  myPhoto: string | null;
  draft: string;
  /** Which row that draft is — see the Composer. */
  draftId?: string | null;
  /** What the header's glass is looking for, if anything. */
  find?: string;
  error?: string;
  /** When everyone else last opened this thread, or null if someone never has. */
  othersReadAt: string | null;
  /** Everyone else on it, so a group can say who has seen it by name. */
  readers?: { name: string; readAt: string | null }[];
}) {
  const [shown, showPending] = useOptimistic(
    messages as Shown[],
    (current, pending: Shown) => [...current, pending],
  );

  /** The message being answered, until it is sent or put down. */
  const [answering, setAnswering] = useState<Quoted | null>(null);

  /*
   * Looking for something said in this conversation.
   *
   * The box is in the header where a chat keeps it, and what it is looking
   * for arrives here through the URL — so a search survives a refresh and can
   * be linked to, and there is one copy of the word rather than two.
   */
  const found = find ?? "";

  /* A quote belongs to the conversation it was picked in. Moving to another
     thread with somebody's line still sitting over the box would send it
     into a conversation it was never said in. */
  useEffect(() => setAnswering(null), [threadId]);

  /*
   * "Seen 5m ago" is only true for a minute.
   *
   * The line under the last message is relative to now, so now has to move.
   * Half a minute is fine for a label whose smallest unit is the minute, and
   * the first tick after mount is also what settles the second of difference
   * between the clock that rendered the HTML and the one reading it.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const term = found.trim().toLowerCase();
  const reading = term
    ? shown.filter((message) => message.body.toLowerCase().includes(term))
    : shown;

  // Only the newest thing you sent carries a status. If that one has been
  // seen, so has everything above it. Membership notices are not messages
  // anybody "reads" with ticks.
  const lastMine = reading.reduce(
    (latest, message, index) => (message.mine && !message.system ? index : latest),
    -1,
  );

  // Object URLs minted for the bubble drawn before the upload finishes.
  const localUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of localUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  async function send(formData: FormData) {
    const body = String(formData.get("body") ?? "").trim();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!body && files.length === 0) return;

    const quoted = answering;
    setAnswering(null);

    showPending({
      id: `pending-${Date.now()}`,
      body,
      senderName: myName,
      senderPhoto: myPhoto,
      mine: true,
      at: new Date().toISOString(),
      deliveredAt: null,
      /**
       * A picture appears at once, from the copy already on this machine —
       * waiting for the upload, the row and a signed URL before anything is
       * drawn is what made sending a photo look like it had done nothing.
       */
      attachments: files.map((file) => {
        const local = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        if (local) localUrls.current.push(local);

        return {
          id: file.name,
          fileName: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
          href: local,
        };
      }),
      replyTo: quoted,
      reactions: [],
      pending: true,
    });

    await sendMessage(formData);
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-7 py-6">
        {/* What is being looked for, and how much of it there is. */}
        {term ? (
          <div
            className="mb-2 shrink-0 text-center text-[11.5px]"
            style={{ color: "var(--chat-muted)" }}
          >
            {reading.length === 0
              ? `Nothing in this conversation says “${found.trim()}”`
              : `${reading.length} ${reading.length === 1 ? "message" : "messages"} matching “${found.trim()}”`}
          </div>
        ) : null}
        {/*
         * A short conversation sits on the composer, not under the heading.
         *
         * Three messages drawn from the top left a screen's worth of empty
         * dark under them and the reply box a long way from the last thing
         * said. `mt-auto` on the transcript rather than `justify-end` on the
         * scroller: aligning a scroll container's own content is what clips
         * the top of it once there is more than fits.
         */}
        <div className="mt-auto">
          {reading.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--chat-muted)" }}>
              {term ? `Nothing here says “${found.trim()}”.` : "Nothing sent yet."}
            </p>
          ) : (
            reading.map((message, index) => {
              const before = index > 0 ? reading[index - 1] : null;

              // A run is the same person still talking, close enough in time
              // that it reads as one turn rather than two.
              const runs =
                !message.system &&
                before !== null &&
                !before.system &&
                before.mine === message.mine &&
                before.senderName === message.senderName &&
                new Date(message.at).getTime() - new Date(before.at).getTime() < 5 * 60 * 1000;

              const newDay = !before || dayOf(before.at) !== dayOf(message.at);
              const opens = newDay || !runs;

              // A photo sent with nothing written under it *is* the message, so
              // it gets no bubble at all. Drawn as one it was a band of accent
              // blue around somebody's screenshot — a frame, and a loud one.
              const photoOnly =
                !message.system &&
                !message.body &&
                message.attachments.length > 0 &&
                message.attachments.every(
                  (file) => file.mimeType?.startsWith("image/") && file.href,
                );

              if (message.system) {
                return (
                  <div key={message.id}>
                    {newDay ? (
                      <div className="my-3.5 flex justify-center">
                        <span
                          className="rounded-[6px] px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            background: "var(--chat-panel)",
                            color: "var(--chat-muted)",
                          }}
                        >
                          {dayLabel(message.at)}
                        </span>
                      </div>
                    ) : null}

                    <div className="my-2.5 flex justify-center px-4">
                      <span
                        className="max-w-[min(90%,420px)] rounded-[8px] px-3 py-1 text-center text-[12px] leading-[1.45]"
                        style={{
                          background: "var(--chat-panel)",
                          color: "var(--chat-muted)",
                        }}
                        title={clockTime(message.at)}
                      >
                        {message.body}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id}>
                  {newDay ? (
                    <div className="my-3.5 flex justify-center">
                      <span
                        className="rounded-[6px] px-2.5 py-1 text-[11px] font-medium"
                        style={{
                          background: "var(--chat-panel)",
                          color: "var(--chat-muted)",
                        }}
                      >
                        {dayLabel(message.at)}
                      </span>
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "group flex items-end gap-2",
                      opens ? "mt-3" : "mt-[2px]",
                      message.mine && "flex-row-reverse",
                    )}
                  >
                    {/* The face sits with the last line of a run, as it does in a
                        chat, and never on your own messages, which need no
                        attribution. */}
                    {message.mine ? null : (
                      <span className="w-6 shrink-0">
                        {opens ? (
                          <span
                            className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
                            style={{
                              background: "var(--avatar-tan-bg)",
                              color: "var(--avatar-tan-fg)",
                            }}
                            title={message.senderName}
                          >
                            {message.senderPhoto ? (
                              // A signed URL on a private bucket, which the image
                              // optimiser cannot fetch; a Google account photo is
                              // refused outright when a referrer is sent.
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={message.senderPhoto}
                                alt=""
                                className="h-full w-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              initialsOf(message.senderName)
                            )}
                          </span>
                        ) : null}
                      </span>
                    )}

                    <div
                      className={cn(
                        // 62% of a narrow pane is a bubble; 62% of a wide one is
                        // a paragraph running the width of a page.
                        "max-w-[min(62%,520px)] transition-opacity",
                        // The padding is for words. A photo on its own has none,
                        // so it fills the corner-rounding itself and carries its
                        // time over the picture.
                        photoOnly
                          ? "relative overflow-hidden"
                          : message.body || message.attachments.length === 0
                            ? "px-3 pb-[7px] pt-2"
                            : "p-1 pb-[5px]",
                        message.mine
                          ? opens
                            ? "rounded-[10px] rounded-tr-[3px]"
                            : "rounded-[10px]"
                          : opens
                            ? "rounded-[10px] rounded-tl-[3px]"
                            : "rounded-[10px]",
                        message.pending && "opacity-80",
                      )}
                      style={
                        photoOnly
                          ? { background: "transparent", color: "var(--chat-ink)" }
                          : message.mine
                            ? { background: "var(--accent)", color: "#fff" }
                            : { background: "var(--chat-them)", color: "var(--chat-ink)" }
                      }
                    >
                      {/*
                       * What this answers, above what it says.
                       *
                       * The words themselves, not a link to them: a quote that
                       * has to be clicked to be read is a quote nobody reads.
                       * Clipped to two lines, because the answer is the
                       * message and this is the context for it.
                       */}
                      {message.replyTo ? (
                        <div
                          className="mb-1 rounded-[6px] border-l-[3px] px-2 py-1"
                          style={{
                            borderColor: message.mine
                              ? "rgba(255,255,255,.65)"
                              : "var(--accent)",
                            background: message.mine
                              ? "rgba(255,255,255,.16)"
                              : "var(--surface-active)",
                          }}
                        >
                          <div
                            className="text-[11.5px] font-semibold"
                            style={{
                              color: message.mine ? "rgba(255,255,255,.92)" : "var(--accent)",
                            }}
                          >
                            {message.replyTo.mine ? "You" : message.replyTo.senderName}
                          </div>
                          <div
                            className="line-clamp-2 text-[12.5px] leading-[1.45]"
                            style={{
                              color: message.mine
                                ? "rgba(255,255,255,.82)"
                                : "var(--chat-muted)",
                            }}
                          >
                            {message.replyTo.body ||
                              (message.replyTo.attachmentCount > 0 ? "📎 Attachment" : "Message")}
                          </div>
                        </div>
                      ) : null}

                      {/* The name is written once per run, and only where there is
                          more than one person it could be. */}
                      {opens && !message.mine && threadKind === "group" ? (
                        <div
                          className="mb-0.5 text-[12.5px] font-semibold"
                          style={{ color: "var(--accent)" }}
                        >
                          {message.senderName}
                        </div>
                      ) : null}

                      {message.attachments.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {message.attachments.map((file) =>
                            file.mimeType?.startsWith("image/") && file.href ? (
                              <a
                                key={file.id}
                                href={file.href}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-[8px]"
                              >
                                {/* Signed URL on a private bucket, so the image
                                    optimiser cannot fetch it. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={file.href}
                                  alt={file.fileName}
                                  className="block max-h-[300px] w-auto max-w-full"
                                />
                              </a>
                            ) : (
                              <a
                                key={file.id}
                                href={file.href ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[12.5px]"
                                style={{
                                  // On the blue bubble, a lighter blue; on a
                                  // white one, a step off the paper.
                                  background: message.mine
                                    ? "rgba(255,255,255,.18)"
                                    : "var(--surface-active)",
                                  color: message.mine ? "#fff" : "var(--chat-ink)",
                                }}
                              >
                                <span aria-hidden>📎</span>
                                <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
                                {file.sizeBytes ? (
                                  <span style={{ opacity: 0.7 }}>{fileSize(file.sizeBytes)}</span>
                                ) : null}
                              </a>
                            ),
                          )}
                        </div>
                      ) : null}

                      {/*
                       * The words, with the time on the end of the last line.
                       *
                       * It sat on a line of its own, which for "hi" made a
                       * bubble twice as tall as the word in it. A chat does
                       * this instead: the time is tucked into the corner, and
                       * a blank the width of it rides at the end of the text
                       * so the last word can never run underneath.
                       */}
                      {message.body ? (
                        <div
                          className={cn(
                            "relative whitespace-pre-wrap break-words text-[13.5px] leading-[1.5]",
                            message.attachments.length > 0 && "mt-1.5",
                          )}
                        >
                          {term ? highlight(message.body, term) : message.body}
                          {/* As wide as what sits in the corner — the blank
                              is what stops the last word running under it,
                              and a time is wider than it looks. */}
                          <span
                            className={cn(
                              "inline-block",
                              message.mine ? "w-[76px]" : "w-[58px]",
                            )}
                            aria-hidden
                          />
                          <span
                            className="absolute bottom-[2px] right-0 flex items-center gap-1 text-[10.5px] leading-none"
                            style={{
                              color: message.mine
                                ? "rgba(255,255,255,.72)"
                                : "var(--chat-faint)",
                            }}
                          >
                            {clockTime(message.at)}
                            {message.mine && !message.pending ? (
                              <BubbleTicks
                                read={Boolean(
                                  othersReadAt &&
                                    new Date(message.at) <= new Date(othersReadAt),
                                )}
                                delivered={Boolean(message.deliveredAt)}
                              />
                            ) : null}
                          </span>
                        </div>
                      ) : (
                        /* Nothing written: a picture, or a file on its own.
                           Then the time has a line to itself, or rides over
                           the corner of the photo. */
                        <div
                          className={cn(
                            "flex items-center justify-end gap-1 text-[10.5px] leading-none",
                            photoOnly
                              ? "absolute bottom-1.5 right-1.5 rounded-full px-1.5 py-[3px]"
                              : "mt-0.5",
                          )}
                          style={{
                            background: photoOnly ? "rgba(0,0,0,.5)" : undefined,
                            color: photoOnly
                              ? "rgba(255,255,255,.92)"
                              : message.mine
                                ? "rgba(255,255,255,.72)"
                                : "var(--chat-faint)",
                          }}
                        >
                          <span>{clockTime(message.at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Answer it, or react to it. Nothing that has not reached
                        the server yet can be either. */}
                    {message.pending ? null : (
                      <MessageActions
                        messageId={message.id}
                        mine={message.mine}
                        onReply={() =>
                          setAnswering({
                            id: message.id,
                            body: message.body,
                            senderName: message.senderName,
                            mine: message.mine,
                            attachmentCount: message.attachments.length,
                          })
                        }
                      />
                    )}
                  </div>

                  <ReactionRow
                    messageId={message.id}
                    reactions={message.reactions}
                    mine={message.mine}
                  />

                  {/* And under it, in words, what happened to it. */}
                  {index === lastMine ? (
                    <div
                      className="mt-1 pr-1 text-right text-[11px]"
                      style={{ color: "var(--chat-muted)" }}
                      // Relative to a clock that ticks; the HTML was written a
                      // moment before the browser read it.
                      suppressHydrationWarning
                    >
                      {deliveryLabel(
                        {
                          pending: message.pending,
                          at: message.at,
                          deliveredAt: message.deliveredAt,
                          readAt: othersReadAt,
                          readers,
                        },
                        now,
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}

          {/* Not while reading search results: jumping to the bottom of a
              filtered list is jumping away from what was searched for. */}
          {term ? null : <ScrollToLatest threadId={threadId} count={shown.length} />}
        </div>
      </div>

      <div className="border-t border-line px-7 py-4">
        {error ? (
          <div className="mb-3">
            <Callout tone="danger">{error}</Callout>
          </div>
        ) : null}

        <Composer
          key={threadId}
          threadId={threadId}
          draft={draft}
          draftId={draftId}
          action={send}
          answering={answering}
          onStopAnswering={() => setAnswering(null)}
        />
      </div>
    </>
  );
}

/**
 * The searched-for word, marked where it appears.
 *
 * Matching is done on the lowercased text and the slices are taken from the
 * original, so what is drawn is what was written — case and all.
 */
function highlight(body: string, term: string) {
  const parts: React.ReactNode[] = [];
  const hay = body.toLowerCase();

  let at = 0;
  let found = hay.indexOf(term);

  while (found !== -1) {
    if (found > at) parts.push(body.slice(at, found));
    parts.push(
      <mark
        key={`${found}-${parts.length}`}
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
      >
        {body.slice(found, found + term.length)}
      </mark>,
    );
    at = found + term.length;
    found = hay.indexOf(term, at);
  }

  if (at < body.length) parts.push(body.slice(at));
  return parts;
}

/**
 * One tick sent, two delivered, two blue read — inside the bubble, where a
 * chat puts them.
 *
 * On a blue bubble the read mark cannot be the product's blue, which is the
 * bubble; it is the pale blue that reads as the same idea against it.
 */
function BubbleTicks({ read, delivered }: { read: boolean; delivered: boolean }) {
  return (
    <svg
      width={read || delivered ? 15 : 10}
      height="10"
      viewBox={read || delivered ? "0 0 15 10" : "0 0 10 10"}
      fill="none"
      aria-hidden
      style={{ color: read ? "#a6e1ff" : "currentColor" }}
    >
      <path
        d="M1 5.6 3.3 7.9 8.6 2.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {read || delivered ? (
        <path
          d="M6 5.6 8.3 7.9 13.6 2.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
