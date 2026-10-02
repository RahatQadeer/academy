"use client";

import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { cn } from "@/base/lib/cn";
import { deliveryLabel } from "@/whitbyos/lib/message-status";
import { sendMessage } from "@/client-portal/lib/actions/messages";
import type { PortalMessage } from "@/client-portal/types";
import { Composer, type ComposerHandle } from "./Composer";
import { Face } from "./Face";
import { clockTime, dayKey, fullTime, separatorLabel } from "./format";

/** Two messages from one person closer together than this read as one turn. */
const RUN_GAP_MS = 5 * 60 * 1000;
/** Within this of the bottom counts as reading the latest. */
const PINNED_PX = 56;

/** A message this browser has sent and the server has not handed back yet. */
type Outgoing = {
  key: string;
  body: string;
  at: string;
  /** The ids on screen when it was sent, so it is never matched to one of them. */
  known: string[];
  state: "sending" | "sent";
};

type Shown = {
  /** Stable across the moment a sent message becomes the server's copy. */
  key: string;
  body: string;
  mine: boolean;
  authorName: string;
  authorPhoto: string | null;
  at: string;
  deliveredAt: string | null;
  state?: Outgoing["state"];
  system?: boolean;
};

/**
 * The open conversation: its messages, and the box under them.
 *
 * SENDING IS INSTANT
 *
 * A message is drawn the moment Send is pressed and the server catches up
 * underneath, which is what every chat does and why they feel instant on
 * connections that are not. Until now the portal waited on the action, then on
 * a refresh, before the bubble existed at all — "Sending…" on a button and
 * nothing in the conversation.
 *
 * The local copy is kept in `outbox` until the server's own row for it arrives
 * in `messages`, and then it hands over its React key to that row. The bubble is
 * the same element before and after, so nothing flickers, nothing re-animates,
 * and a message that failed is never left behind pretending it worked.
 * `useOptimistic` was the obvious tool and the wrong one here: it
 * drops the optimistic row as soon as the action settles, and the portal's
 * refresh lands after that (see `Composer`'s old note on `router.refresh()`),
 * so the message vanished for a frame between the two.
 *
 * A send that fails does what Whitby's does and what the portal's composer
 * always did: the bubble goes, the words go back in the box, and one sentence
 * above it says why. There is no per-message retry, because the professional
 * side has none either.
 *
 * THE VIEW STAYS AT THE LATEST
 *
 * A conversation opens at its newest line, and every new message — sent here
 * or arriving live — brings the view down to it, as Whitby's `ScrollToLatest`
 * does. A new message grows its own row open so the ones above ease up rather
 * than jump.
 */
export function Conversation({
  threadId,
  messages,
  othersReadAt,
  timezone,
  group,
  recipient,
  canReply,
}: {
  threadId: string;
  messages: PortalMessage[];
  /** When everyone else last opened the thread, or null if someone never has. */
  othersReadAt: string | null;
  timezone: string;
  /** More than one other person, so each run of theirs is named. */
  group: boolean;
  /** Who a reply goes to, in the composer's placeholder. */
  recipient: string;
  /** False for a view-only member, whom `sendMessage` would refuse. */
  canReply: boolean;
}) {
  const router = useRouter();
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  // Server id → the local key its bubble was first drawn under.
  const [claimed, setClaimed] = useState<Record<string, string>>({});
  // What the conversation opened with animates in with nothing; everything
  // after it — sent here or arriving live — rises in.
  const [initial] = useState(() => new Set(messages.map((message) => message.id)));
  const [failed, setFailed] = useState(false);

  /*
   * "Seen 5m ago" is only true for a minute, so now has to move. The first
   * tick also settles the second between the clock that wrote the HTML and
   * the one reading it.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { shown, settled } = useMemo(() => {
    const keys = new Map(Object.entries(claimed));
    const settled: [string, string][] = [];
    const waiting: Outgoing[] = [];

    for (const item of outbox) {
      const match = messages.find(
        (message) =>
          message.authorIsMe &&
          message.body.trim() === item.body &&
          !item.known.includes(message.id) &&
          !keys.has(message.id),
      );
      if (match) {
        keys.set(match.id, item.key);
        settled.push([match.id, item.key]);
      } else {
        waiting.push(item);
      }
    }

    const shown: Shown[] = [
      ...messages.map((message) => ({
        key: keys.get(message.id) ?? message.id,
        body: message.body,
        mine: message.authorIsMe,
        authorName: message.authorName,
        authorPhoto: message.authorPhoto,
        at: message.sentAt,
        deliveredAt: message.deliveredAt,
        system: message.system,
      })),
      ...waiting.map((item) => ({
        key: item.key,
        body: item.body,
        mine: true,
        authorName: "You",
        authorPhoto: null,
        at: item.at,
        deliveredAt: null,
        state: item.state,
      })),
    ];

    return { shown, settled };
  }, [claimed, messages, outbox]);

  // Hand the settled ones over for good, once they have been drawn under the
  // server's row.
  useEffect(() => {
    if (settled.length === 0) return;
    setClaimed((current) => ({ ...current, ...Object.fromEntries(settled) }));
    const done = new Set(settled.map(([, key]) => key));
    setOutbox((current) => current.filter((item) => !done.has(item.key)));
  }, [settled]);

  function deliver(key: string, body: string) {
    startTransition(async () => {
      const form = new FormData();
      form.set("threadId", threadId);
      form.set("body", body);

      try {
        await sendMessage(form);
      } catch (error) {
        setOutbox((current) => current.filter((item) => item.key !== key));
        composer.current?.restore(body);
        setFailed(true);
        // A refused send redirects with its reason, and `redirect` works by
        // throwing. That throw belongs to the router, not to this catch.
        unstable_rethrow(error);
        return;
      }

      setOutbox((current) =>
        current.map((item) => (item.key === key ? { ...item, state: "sent" } : item)),
      );
      // `revalidatePath` does not reliably reach this router — every portal
      // screen renders through `app/[product]/[[...slug]]` — so the thread asks
      // for itself by what it actually is.
      router.refresh();
    });
  }

  function send(body: string) {
    setFailed(false);
    const key = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setOutbox((current) => [
      ...current,
      {
        key,
        body,
        at: new Date().toISOString(),
        known: messages.map((message) => message.id),
        state: "sending",
      },
    ]);
    deliver(key, body);
  }

  // ── scrolling ──────────────────────────────────────────────────────────

  // Open at the newest line, before the first paint, so the history never
  // flashes past on the way down.
  useLayoutEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, []);

  // While the reader is at the bottom, anything that changes the height — a
  // row growing open, the composer taking another line, a photo loading —
  // keeps them there, frame by frame.
  useEffect(() => {
    const box = scroller.current;
    const inner = content.current;
    if (!box || !inner) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) box.scrollTop = box.scrollHeight;
    });
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const lastKey = shown[shown.length - 1]?.key;
  const previousLast = useRef(lastKey);
  useEffect(() => {
    if (lastKey === previousLast.current) return;
    previousLast.current = lastKey;
    const box = scroller.current;
    if (!box || pinned.current) return;
    pinned.current = true;
    box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [lastKey]);

  function onScroll() {
    const box = scroller.current;
    if (!box) return;
    pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < PINNED_PX;
  }


  // ── drawing ────────────────────────────────────────────────────────────

  // Only the newest thing you sent carries a status. If that has been seen,
  // so has everything above it.
  const lastMineIndex = shown.reduce(
    (found, message, index) => (message.mine && !message.system ? index : found),
    -1,
  );

  return (
    <>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="cp-chat-scroll absolute inset-0 overflow-y-auto"
          role="log"
          aria-label="Messages"
          aria-live="polite"
          aria-relevant="additions"
        >
          {/* `mt-auto` rather than `justify-end` on the scroller: a short
              conversation sits on the composer, and aligning a scroll
              container's own content clips its top once it overflows. */}
          <div ref={content} className="flex min-h-full flex-col px-3 py-6 sm:px-7">
            <div className="mt-auto">
              {shown.length === 0 ? (
                <FirstMessage recipient={recipient} canReply={canReply} />
              ) : (
                shown.map((message, index) => {
                  const before = shown[index - 1];

                  const newDay =
                    !before || dayKey(before.at, timezone) !== dayKey(message.at, timezone);

                  // A run is the same person still talking, close enough in
                  // time that it reads as one turn rather than two.
                  const runs =
                    Boolean(before) &&
                    !message.system &&
                    !before!.system &&
                    before!.mine === message.mine &&
                    before!.authorName === message.authorName &&
                    Date.parse(message.at) - Date.parse(before!.at) < RUN_GAP_MS;

                  const opens = newDay || !runs;
                  const fresh = !initial.has(message.key);

                  if (message.system) {
                    return (
                      <div key={message.key} className={fresh ? "cp-row-grow" : undefined}>
                        <div className={fresh ? "min-h-0 overflow-hidden" : undefined}>
                          {newDay ? <DayPill at={message.at} timezone={timezone} now={now} /> : null}
                          <div className="my-2.5 flex justify-center px-2">
                            <span
                              className="max-w-[min(90%,420px)] rounded-[8px] px-3 py-1 text-center text-[12px] leading-[1.45]"
                              style={{
                                background: "var(--chat-panel)",
                                color: "var(--chat-muted)",
                              }}
                              title={clockTime(message.at, timezone)}
                            >
                              {message.body}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={message.key} className={fresh ? "cp-row-grow" : undefined}>
                      <div className={fresh ? "min-h-0 overflow-hidden" : undefined}>
                        {newDay ? <DayPill at={message.at} timezone={timezone} now={now} /> : null}

                        <Bubble
                          message={message}
                          opens={opens}
                          named={group && opens && !message.mine}
                          fresh={fresh}
                          timezone={timezone}
                        />

                        {index === lastMineIndex ? (
                          <Status
                            label={deliveryLabel(
                              {
                                pending: message.state === "sending",
                                at: message.at,
                                deliveredAt: message.deliveredAt,
                                readAt: message.state ? null : othersReadAt,
                              },
                              now,
                            )}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {canReply ? (
        <div
          className="shrink-0 border-t px-3 py-3 sm:px-7 sm:py-4"
          style={{ borderColor: "var(--chat-line)" }}
        >
          {failed ? (
            <p
              role="alert"
              className="cp-fade-up mb-2.5 text-[12.5px]"
              style={{ color: "var(--chat-danger)" }}
            >
              Could not send that — you may be offline. Your message is still here; press Send to
              try again.
            </p>
          ) : null}
          <Composer ref={composer} onSend={send} recipient={recipient} />
        </div>
      ) : (
        <p
          className="shrink-0 border-t px-5 py-4 text-center text-[12.5px] leading-[1.5]"
          style={{ borderColor: "var(--chat-line)", color: "var(--chat-muted)" }}
        >
          Your access to this account is view only, so you can read this conversation but not reply.
        </p>
      )}
    </>
  );
}

/**
 * One message, as Whitby's conversation draws it: a 10px bubble with its corner
 * tucked toward the speaker at the start of a run, the name inside it in a
 * group, and the time riding in its lower right.
 */
function Bubble({
  message,
  opens,
  named,
  fresh,
  timezone,
}: {
  message: Shown;
  /** First of a run: carries the face, and the corner toward the speaker is tucked. */
  opens: boolean;
  named: boolean;
  fresh: boolean;
  timezone: string;
}) {
  const { mine } = message;

  return (
    <div
      className={cn("flex items-end gap-2", opens ? "mt-3" : "mt-[2px]", mine && "flex-row-reverse")}
    >
      {/* The face sits with the first line of a run, and never on your own
          messages, which need no attribution. */}
      {mine ? null : (
        <span className="w-6 shrink-0 self-start" aria-hidden>
          {opens ? <Face name={message.authorName} photo={message.authorPhoto} size={24} /> : null}
        </span>
      )}

      <div
        data-side={mine ? "mine" : "them"}
        className={cn(
          // 62% of a narrow pane is a bubble; 62% of a wide one is a paragraph
          // running the width of a page.
          "max-w-[min(78%,520px)] px-3 pb-[7px] pt-2 sm:max-w-[min(62%,520px)]",
          "rounded-[10px]",
          opens && (mine ? "rounded-tr-[3px]" : "rounded-tl-[3px]"),
          message.state === "sending" && "opacity-80",
          fresh && "cp-msg-in",
        )}
        style={
          mine
            ? { background: "var(--chat-mine)", color: "#fff" }
            : {
                background: "var(--chat-them)",
                color: "var(--chat-ink)",
                boxShadow: "0 1px 1px rgb(var(--shade-rgb) / .06)",
              }
        }
      >
        <span className="sr-only">
          {mine ? "You" : message.authorName}, {fullTime(message.at, timezone)}:{" "}
        </span>

        {/* The name is written once per run, and only where there is more
            than one person it could be. */}
        {named ? (
          <div className="mb-0.5 text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
            {message.authorName}
          </div>
        ) : null}

        <div className="whitespace-pre-wrap text-[13.5px] leading-[1.5] [overflow-wrap:anywhere]">
          {message.body}
        </div>

        <div
          className="mt-0.5 flex items-center justify-end text-[10.5px] leading-none"
          style={{ color: mine ? "var(--chat-mine-meta)" : "var(--chat-faint)" }}
          aria-hidden
        >
          <time dateTime={message.at} title={fullTime(message.at, timezone)} suppressHydrationWarning>
            {clockTime(message.at, timezone)}
          </time>
        </div>
      </div>
    </div>
  );
}

/** The day a run of messages was said on, in a small pill between them. */
function DayPill({ at, timezone, now }: { at: string; timezone: string; now: number }) {
  return (
    <div className="my-3.5 flex justify-center">
      <span
        className="rounded-[6px] px-2.5 py-1 text-[11px] font-medium"
        style={{ background: "var(--chat-panel)", color: "var(--chat-muted)" }}
        suppressHydrationWarning
      >
        {separatorLabel(at, timezone, now).day}
      </span>
    </div>
  );
}

/** What happened to the last thing you sent, in words, under it. */
function Status({ label }: { label: string }) {
  return (
    <div
      className="mt-1 pr-1 text-right text-[11px]"
      style={{ color: "var(--chat-muted)" }}
      suppressHydrationWarning
    >
      {/* Keyed by what it says, so "Sending…" becoming "Delivered" fades
          rather than snaps. */}
      <span key={label} className="cp-fade-up inline-block" suppressHydrationWarning>
        {label}
      </span>
    </div>
  );
}

function FirstMessage({ recipient, canReply }: { recipient: string; canReply: boolean }) {
  return (
    <div className="cp-fade-up flex flex-col items-center pb-8 text-center">
      <span
        aria-hidden
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] text-[18px]"
        style={{ background: "var(--chat-them)", color: "var(--accent)" }}
      >
        ✉
      </span>
      <p className="text-[14px] font-semibold" style={{ color: "var(--chat-ink)" }}>
        Nothing sent yet
      </p>
      <p
        className="mt-1 max-w-[260px] text-[12.5px] leading-[1.5]"
        style={{ color: "var(--chat-muted)" }}
      >
        {canReply
          ? `Anything you write here goes straight to ${recipient}.`
          : "Messages will appear here as soon as someone writes."}
      </p>
    </div>
  );
}
