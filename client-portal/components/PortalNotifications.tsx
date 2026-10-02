"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SubmitPlain } from "@/base/components/Submit";
import { relativeTime } from "@/client-portal/lib/format";
import type { Notice } from "@/whitbyos/lib/notifications";
import { DecideDeletion } from "@/whitbyos/components/DecideDeletion";
import { ActivityMark } from "./ActivityMark";
import { PanelTile } from "./Panel";
import type { ActivityKind } from "@/client-portal/types";

/**
 * The portal's bell, and what is under it.
 *
 * A portal-owned copy of `whitbyos/components/NotificationBell`, for the reason
 * `DataTable` gives for being one: the two ship on separate branches and the
 * professional's is edited often, so a shared file would make every change to
 * the practitioner's bell a change to the client's. The behaviour is the same
 * on both sides — the notices are read on the server and handed down, and only
 * opening and closing is state — and what differs is the drawing.
 *
 * WHAT CHANGED
 *
 * It was a white card of near-identical lines: a red dot, a sentence, a
 * timestamp, repeated. Six notices about six different things — an invoice, two
 * signatures, a form — read as one block of text, and nothing in a row said
 * which of them was a thing to do rather than a thing that happened.
 *
 * So it is drawn as the portal's lists now, in the same material: a mark per
 * kind in the tile a row leads with, the asks in the warning colours and the
 * news in the quiet ones, and an unread row on a ground you can actually pick
 * out rather than a white one a shade off the white beside it.
 *
 * It also closes when you press outside it or press Escape, which it did not.
 * A panel that covers a third of the screen and can only be dismissed by
 * finding the 36px button that opened it is a panel people navigate away from.
 */
export function PortalNotifications({
  notices,
  unread,
  here,
  readAll,
  readOne,
}: {
  notices: Notice[];
  unread: number;
  /** Where an answer returns to, which is the page the bell was opened on. */
  here: string;
  readAll: (formData: FormData) => Promise<void>;
  readOne: (noticeId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    // `pointerdown`, not `click`: a press that starts outside the panel has
    // already decided to leave it, and waiting for the release leaves the
    // panel open under the finger on a touch screen.
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="pa-bar-btn relative"
      >
        <BellIcon ringing={unread > 0} />
        {unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full px-1 text-[9.5px] font-bold text-white"
            style={{ background: "var(--danger-solid)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="pa-chat-pane cp-chat cp-fade-up absolute right-0 z-40 mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[16px]"
          style={{
            boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .1), 0 18px 44px -18px rgb(var(--shade-rgb) / .38)",
          }}
          role="dialog"
          aria-label="Notifications"
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ background: "var(--surface)" }}
          >
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">Notifications</div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                {notices.length === 0
                  ? "Nothing yet"
                  : unread > 0
                    ? `${unread} unread`
                    : "All read"}
              </div>
            </div>
            {unread > 0 ? (
              <form action={readAll}>
                <input type="hidden" name="back" value={here} />
                <SubmitPlain
                  className="cp-press rounded-full px-2.5 py-1 text-[12px] font-medium hover:bg-[var(--surface-active)]"
                  style={{ color: "var(--accent)" }}
                >
                  Mark all read
                </SubmitPlain>
              </form>
            ) : null}
          </div>

          {notices.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 border-t px-6 py-10 text-center"
              style={{ borderColor: "var(--chat-line)", background: "var(--chat-ground)" }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[13px]"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                aria-hidden
              >
                <BellIcon ringing={false} />
              </span>
              <span className="text-[13px] font-semibold">Nothing yet</span>
              <span className="text-[12px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
                When your team shares something or needs an answer, it will arrive here.
              </span>
            </div>
          ) : (
            <ul
              className="cp-chat-scroll max-h-[420px] overflow-y-auto border-t"
              style={{ borderColor: "var(--chat-line)", background: "var(--chat-ground)" }}
            >
              {notices.map((notice) => (
                <NoticeRow
                  key={notice.id}
                  notice={notice}
                  onOpen={() => setOpen(false)}
                  readOne={readOne}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function NoticeRow({
  notice,
  onOpen,
  readOne,
}: {
  notice: Notice;
  onOpen: () => void;
  readOne: (noticeId: string) => Promise<void>;
}) {
  // An unanswered ask is the only kind with buttons, and it is not a link:
  // pressing it would carry the client away from the question.
  const pending = Boolean(notice.deletionRequestId) && !notice.decided;
  const canOpen = Boolean(notice.href) && !pending;
  const asking = pending || ASKS.has(notice.kind);
  const surface = notice.read ? undefined : "var(--accent-tint-mid)";

  const copy = (
    <span className="flex items-start gap-2.5 px-4 py-3">
      <span className="relative shrink-0">
        <PanelTile
          size="sm"
          tone={asking ? "warning" : NEWS.has(notice.kind) ? "accent" : "neutral"}
        >
          <ActivityMark kind={markFor(notice.kind)} />
        </PanelTile>
        {/* The mark sits on the tile it belongs to, as the Messages rail puts
            it on the face. Inline before the title, it moved every read row's
            first word 13px left of every unread one. */}
        {notice.read ? null : (
          <span
            aria-label="Unread"
            className="absolute -right-[3px] -top-[3px] h-[9px] w-[9px] rounded-full"
            style={{
              background: "var(--danger-solid)",
              border: `2px solid ${surface ?? "var(--chat-ground)"}`,
              boxSizing: "content-box",
            }}
          />
        )}
      </span>

      <span className="block min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span
            className="min-w-0 text-[13px]"
            style={{ fontWeight: notice.read ? 500 : 600 }}
          >
            {notice.title}
          </span>
          <span
            className="shrink-0 pt-px text-[11px] tabular-nums"
            style={{ color: "var(--text-quiet)" }}
            suppressHydrationWarning
          >
            {relativeTime(notice.createdAt)}
          </span>
        </span>

        {notice.body ? (
          <span
            className="mt-1 block text-[12px] leading-[1.5]"
            style={{ color: "var(--text-secondary)" }}
          >
            {notice.body}
          </span>
        ) : null}
      </span>
    </span>
  );

  return (
    <li
      className="group border-b last:border-b-0"
      style={{ borderColor: "var(--chat-line)", background: surface }}
    >
      {canOpen && notice.href ? (
        <Link
          href={notice.href}
          onClick={() => {
            onOpen();
            // Opening it is having seen it. Fired rather than awaited: the
            // navigation should not wait on a write whose only job is to stop
            // a dot being drawn.
            if (!notice.read) void readOne(notice.id);
          }}
          className="block no-underline transition-colors duration-150 hover:bg-[var(--surface-active)]"
          style={{ color: "var(--ink)" }}
        >
          {copy}
        </Link>
      ) : (
        <span className="block" style={{ color: "var(--ink)" }}>
          {copy}
        </span>
      )}

      {pending && notice.deletionRequestId ? (
        <span className="block pb-3 pl-[70px] pr-4">
          <DecideDeletion requestId={notice.deletionRequestId} />
        </span>
      ) : notice.deletionRequestId ? (
        <span
          className="block pb-3 pl-[70px] pr-4 text-[11.5px]"
          style={{ color: "var(--text-quiet)" }}
        >
          Already answered.
        </span>
      ) : null}
    </li>
  );
}

/**
 * The kinds that are asking something of the client rather than telling them
 * something. They carry the warning tile, which is the same colour the Action
 * Needed list is drawn in, so a notice about work and the work itself look
 * like the same thing.
 */
const ASKS = new Set([
  "action_needed",
  "form_requested",
  "signature_requested",
  "approval_requested",
  "deletion_requested",
]);

/** Your team speaking to you, rather than a record being filed. */
const NEWS = new Set(["new_message", "message_thread_added", "progress_update"]);

/**
 * A notice's kind onto one of the eight marks the portal draws.
 *
 * Written out rather than guessed from the string: these values are chosen by
 * the professional's side (`notifyClientContacts`, `DELETION_KIND`) and a mark
 * picked by substring would change the moment somebody there renames one.
 */
const MARKS: Record<string, ActivityKind> = {
  new_message: "message",
  message_thread_added: "message",
  progress_update: "update",
  request_status_change: "request",
  document_shared: "document",
  signature_requested: "document",
  signature_signed: "document",
  signature_declined: "document",
  deletion_requested: "document",
  deletion_approved: "document",
  deletion_declined: "document",
  form_requested: "form",
  action_needed: "form",
  invoice_sent: "invoice",
  invoice_payment_event: "invoice",
  calendar_event: "event",
  calendar_change: "event",
};

function markFor(kind: string): ActivityKind {
  return MARKS[kind] ?? "update";
}

/**
 * A bell, drawn rather than borrowed from the glyph set — the same one the
 * professional's bar draws. The clapper swings when there is something unread,
 * so the shape carries the state as well as the count beside it does.
 */
function BellIcon({ ringing }: { ringing: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2.1c-2.1 0-3.6 1.6-3.6 3.6 0 2.6-.5 3.6-1.2 4.4-.2.3 0 .7.4.7h8.8c.4 0 .6-.4.4-.7-.7-.8-1.2-1.8-1.2-4.4 0-2-1.5-3.6-3.6-3.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 1v1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path
        d={ringing ? "M6.5 12.8a1.7 1.7 0 0 0 3.1.3" : "M6.6 12.8a1.5 1.5 0 0 0 2.8 0"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
