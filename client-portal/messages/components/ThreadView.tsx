import Link from "next/link";
import { Suspense } from "react";
import { listMessages } from "@/client-portal/lib/data/messages";
import type { MessageThread } from "@/client-portal/types";
import { Conversation } from "./Conversation";
import { Face } from "./Face";
import { MarkRead } from "./MarkRead";
import { ConversationBodySkeleton } from "./MessagesSkeleton";
import { isGroup } from "./rail";
import { ThreadMenu, type MenuItem } from "./ThreadMenu";

/**
 * One conversation: who it is with, and what has been said — under Whitby's
 * heading.
 *
 * A direct conversation leads with the person, the way a chat does. A group
 * leads with its own name and says who is in it. The heading is drawn at once
 * from the thread row the list already has, and the messages stream in under
 * it.
 */
export function ThreadView({
  thread,
  timezone,
  canReply,
  backHref,
  newHref,
}: {
  thread: MessageThread;
  timezone: string;
  canReply: boolean;
  /** The list, for the back control on a screen too narrow to show both. */
  backHref: string;
  /** Where "new conversation" goes, or null for a view-only member. */
  newHref: string | null;
}) {
  // Whitby's own word for it, not a count of the roster — see `isGroup`.
  const group = isGroup(thread);
  const counterparty = thread.participants[0] ?? thread.subject;
  const recipient =
    thread.participants.length === 0
      ? "your team"
      : thread.participants.length === 1
        ? thread.participants[0]!.split(/\s+/)[0]!
        : "the group";

  const subject =
    thread.subject.trim().toLowerCase() === counterparty.trim().toLowerCase()
      ? null
      : thread.subject;
  const detail = [
    group ? thread.participants.join(", ") : subject,
    thread.requestTitle,
    group ? `${thread.participants.length + 1} people` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const menu: MenuItem[] = [
    ...(thread.requestId
      ? [
          {
            label: "Open request",
            href: `/client-portal/requests/${thread.requestId}`,
            detail: thread.requestTitle ?? undefined,
          },
        ]
      : []),
    ...(newHref ? [{ label: "New conversation", href: newHref }] : []),
  ];

  return (
    <>
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:gap-4 sm:px-7 sm:py-4"
        style={{ borderColor: "var(--chat-line)", background: "var(--surface)" }}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href={backHref}
            aria-label="All conversations"
            className="cp-press -ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full no-underline hover:bg-[var(--surface-active)] lg:hidden"
            style={{ color: "var(--accent)" }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M11 3.5L5.5 9l5.5 5.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* A group wears the initials of its name — the same mark the rail
              draws, so one is recognised as the other. */}
          {group ? (
            <Face name={thread.subject} />
          ) : (
            <Face name={counterparty} photo={thread.counterpartyPhoto} />
          )}

          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-bold" style={{ color: "var(--chat-ink)" }}>
              {group ? thread.subject : counterparty}
            </h2>
            {detail || thread.locked ? (
              <p
                className="mt-[3px] flex min-w-0 items-center gap-1.5 text-[12.5px]"
                style={{ color: "var(--chat-muted)" }}
              >
                {detail ? <span className="truncate">{detail}</span> : null}
                {thread.locked ? (
                  <span
                    className="flex shrink-0 items-center gap-1"
                    title="Only your team can change who is in this conversation"
                  >
                    {detail ? <span aria-hidden>·</span> : null}
                    <LockIcon />
                    <span className="hidden sm:inline">Participants locked</span>
                    <span className="sr-only sm:hidden">Participants locked</span>
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <ThreadMenu items={menu} label={group ? "Group menu" : "Conversation menu"} />
      </header>

      <Suspense key={thread.id} fallback={<ConversationBodySkeleton />}>
        <Messages
          thread={thread}
          timezone={timezone}
          group={group}
          recipient={recipient}
          canReply={canReply}
        />
      </Suspense>

      {/* Opening a thread is reading it. */}
      <MarkRead threadId={thread.id} />
    </>
  );
}

async function Messages({
  thread,
  timezone,
  group,
  recipient,
  canReply,
}: {
  thread: MessageThread;
  timezone: string;
  group: boolean;
  recipient: string;
  canReply: boolean;
}) {
  const messages = await listMessages(thread.id);

  return (
    <Conversation
      // A different conversation is a different scroll position, outbox and
      // history — never a re-render of the last one.
      key={thread.id}
      threadId={thread.id}
      messages={messages}
      othersReadAt={thread.othersReadAt}
      timezone={timezone}
      /*
       * Two different questions, and only the header's is answered by `kind`.
       *
       * The header asks "is this a group", which is Whitby's word for it. The
       * body asks "do these messages need a name over them", which is about
       * who has actually spoken: a conversation a client started stays visible
       * to the team until somebody opens it and is joined (whitbyos/090), so a
       * second professional can reply in a direct one — and two people's
       * messages with no names on them is the one thing the body must not
       * draw.
       */
      group={
        group || new Set(messages.filter((m) => !m.authorIsMe).map((m) => m.authorName)).size > 1
      }
      recipient={recipient}
      canReply={canReply}
    />
  );
}

function LockIcon() {
  return (
    <svg width="10" height="11" viewBox="0 0 10 11" fill="none" aria-hidden className="shrink-0">
      <rect x="1" y="4.75" width="8" height="5.5" rx="1.5" fill="currentColor" />
      <path d="M2.9 4.9V3.4a2.1 2.1 0 0 1 4.2 0v1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
