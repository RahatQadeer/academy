"use client";

import { SubmitPlain } from "@/base/components/Submit";

import { useState } from "react";
import Link from "next/link";
import { relativeTime } from "@/whitbyos/lib/format";
import type { Notice } from "@/whitbyos/lib/notifications";
import { readAllNotices, readNotice } from "@/whitbyos/notifications/actions";
import { DecideDeletion } from "@/whitbyos/components/DecideDeletion";

/**
 * The bell, and what is under it.
 *
 * It sits in the shell's header, so it is on every screen. The notices are
 * read on the server and handed down; only opening and closing is state, which
 * is why this is a client component and the reading is not.
 *
 * An unanswered request to delete something is the only kind with buttons.
 * Everything else is a line of news: it happened, and this is when.
 */
export function NotificationBell({
  notices,
  unread,
  here,
  readAll = readAllNotices,
  readOne = readNotice,
}: {
  notices: Notice[];
  unread: number;
  /** Where an answer returns to, which is the page the bell was opened on. */
  here: string;
  /**
   * What Mark all read posts to. Whitby's own by default; the Client Portal
   * passes the one that marks a contact's notices rather than a member's.
   */
  readAll?: (formData: FormData) => Promise<void>;
  /**
   * What opening one posts. The Client Portal passes its own, which marks a
   * contact's notice rather than a member's.
   */
  readOne?: (noticeId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
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
          className="absolute right-0 z-40 mt-2 w-[360px] overflow-hidden rounded-card border border-line shadow-float"
          style={{ background: "var(--surface)" }}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[13px] font-semibold">Notifications</span>
            {unread > 0 ? (
              <form action={readAll}>
                <input type="hidden" name="back" value={here} />
                <SubmitPlain
                 
                  className="text-[12px] font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  Mark all read
                </SubmitPlain>
              </form>
            ) : null}
          </div>

          {notices.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              Nothing yet.
            </p>
          ) : (
            <div className="max-h-[380px] overflow-y-auto">
              {notices.map((notice) => {
                const canOpen =
                  Boolean(notice.href) && !(notice.deletionRequestId && !notice.decided);
                const copy = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      {/* A dot, not a tint. An unread notice on a very slightly
                          different ground is one nobody can pick out of six;
                          the same red the badge counts says which ones it is
                          counting. */}
                      {notice.read ? null : (
                        <span
                          aria-label="Unread"
                          className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full"
                          style={{ background: "var(--danger-solid)" }}
                        />
                      )}
                      <span className="min-w-0 flex-1 text-[13px] font-medium">{notice.title}</span>
                      <span
                        className="shrink-0 text-[11px]"
                        style={{ color: "var(--text-quiet)" }}
                      >
                        {relativeTime(notice.createdAt)}
                      </span>
                    </div>

                    {notice.body ? (
                      <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
                        {notice.body}
                      </p>
                    ) : null}
                  </>
                );

                return (
                  <div
                    key={notice.id}
                    className="border-b border-line px-4 py-3 last:border-b-0"
                    style={notice.read ? undefined : { background: "var(--surface-soft)" }}
                  >
                    {canOpen && notice.href ? (
                      <Link
                        href={notice.href}
                        onClick={() => {
                          setOpen(false);
                          // Opening it is having seen it. Fired rather than
                          // awaited: the navigation should not wait on a write
                          // whose only job is to stop a dot being drawn.
                          if (!notice.read) void readOne(notice.id);
                        }}
                        className="block no-underline"
                        style={{ color: "inherit" }}
                      >
                        {copy}
                      </Link>
                    ) : (
                      copy
                    )}

                    {notice.deletionRequestId && !notice.decided ? (
                      <div className="mt-2.5">
                        <DecideDeletion requestId={notice.deletionRequestId} />
                      </div>
                    ) : notice.deletionRequestId ? (
                      <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
                        Already answered.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A bell, drawn rather than borrowed from the glyph set.
 *
 * The header used ◔ — a quartered circle, the closest the set gets and not
 * close: it reads as a chart or a clock, and nothing about it says something is
 * waiting. The rail's own icons are SVG for the same reason.
 *
 * The clapper swings when there is something unread, so the shape carries the
 * state as well as the count beside it does.
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
