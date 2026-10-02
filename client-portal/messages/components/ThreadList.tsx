"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/base/lib/cn";
import { relativeTime } from "@/client-portal/lib/format";
import type { MessageThread } from "@/client-portal/types";
import { Face } from "./Face";
import { isGroup, messagesHref, type RailKind, type RailTab } from "./rail";

const TABS: { key: RailTab; label: string }[] = [
  { key: "conversations", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "by-request", label: "By Request" },
];

/** A subject as a sentence: "testing" reads as "Testing" beside a name. */
function sentence(text: string) {
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Who a direct row is with. With nobody else on it yet there is no name to
 * show, so the subject takes the line.
 *
 * Names arrive capitalised from `listThreads`, which is where a professional
 * typed into Whitby as "professional" is raised, so every screen says it the
 * same way.
 */
function counterpartyOf(thread: MessageThread) {
  return thread.participants[0] ?? sentence(thread.subject);
}

/**
 * The subject, in brackets beside the name — but only where it says something
 * neither the name nor the Request tag under it already says. A row that
 * printed the person, the subject and the Request as three stacked lines said
 * the same thing up to three times and stood twice as tall for it.
 */
function bracketedSubject(thread: MessageThread, showRequest: boolean) {
  const subject = thread.subject.trim();
  // Nobody else on the thread: the subject is already the title of the row.
  if (!subject || thread.participants.length === 0) return null;

  const says = (other: string | null | undefined) =>
    Boolean(other) && subject.toLowerCase() === other!.trim().toLowerCase();
  if (says(thread.participants[0])) return null;
  if (showRequest && says(thread.requestTitle)) return null;
  return sentence(subject);
}

/**
 * The left column, in Whitby's layout: the title and what is open, the search,
 * the Request filter, Direct and Group, the filter chips, and the rows.
 *
 * SEARCH AND THE REQUEST FILTER NARROW WHAT IS ALREADY HERE
 *
 * Every thread the client can see is already on the page, so both are filters
 * over rows in hand rather than a round trip per keystroke — a navigation on
 * this catch-all route replaces the content area with a loading state. Both are
 * still written to the URL with `history.replaceState`, so they survive a
 * refresh and can be linked to without re-rendering anything.
 *
 * A ROW IS FETCHED BEFORE IT IS CLICKED
 *
 * Hovering a row — or pressing it, on a screen with no hover — asks for the
 * whole conversation, so by the time the click lands it is usually here.
 */
export function ThreadRail({
  threads,
  activeId,
  kind,
  tab,
  initialQuery,
  initialRequest,
  counts,
  newHref,
}: {
  /** This kind's threads, already narrowed to Unread where that is the tab. */
  threads: MessageThread[];
  activeId?: string;
  kind: RailKind;
  tab: RailTab;
  initialQuery: string;
  initialRequest: string;
  counts: {
    open: number;
    unread: number;
    byRequest: number;
    /** Something unread on the Direct or Group tab you are not looking at. */
    unreadElsewhere: boolean;
  };
  /** Where "new conversation" goes, or null for a view-only member. */
  newHref: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [request, setRequest] = useState(initialRequest);
  const needle = query.trim().toLowerCase();
  const router = useRouter();
  const warmed = useRef(new Set<string>());

  useEffect(() => {
    const url = new URL(window.location.href);
    if (needle) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    if (request) url.searchParams.set("request", request);
    else url.searchParams.delete("request");
    if (url.href !== window.location.href) window.history.replaceState(null, "", url.href);
  }, [needle, query, request]);

  /* Every Request that actually has a conversation here, named once. A list of
     every request on the account, most leading to an empty rail, is a longer
     way of finding out that nothing was said. */
  const requestOptions = useMemo(
    () => [
      ...new Map(
        threads
          .filter((thread) => thread.requestId && thread.requestTitle)
          .map((thread) => [thread.requestId as string, thread.requestTitle as string]),
      ),
    ],
    [threads],
  );

  const visible = useMemo(
    () =>
      threads.filter((thread) => {
        if (request && thread.requestId !== request) return false;
        if (!needle) return true;
        return (
          thread.subject.toLowerCase().includes(needle) ||
          thread.preview.toLowerCase().includes(needle) ||
          (thread.requestTitle?.toLowerCase().includes(needle) ?? false) ||
          thread.participants.some((one) => one.toLowerCase().includes(needle))
        );
      }),
    [needle, request, threads],
  );

  const q = query.trim() || undefined;
  const link = (params: { kind?: RailKind; tab?: RailTab; thread?: string }) =>
    messagesHref({ kind, tab, ...params, q, request: request || undefined });

  function warm(id: string) {
    if (id === activeId || warmed.current.has(id)) return;
    warmed.current.add(id);
    // "full" is `PrefetchKind.FULL`: the whole conversation, not only the
    // loading state an automatic prefetch stops at. Written as its value
    // because the enum lives in Next's internals, not its public exports.
    router.prefetch(link({ thread: id }), {
      kind: "full",
    } as Parameters<typeof router.prefetch>[1]);
  }

  const groups = tab === "by-request" ? [...group(visible).entries()] : [[null, visible] as const];
  const chipCount: Record<RailTab, number> = {
    conversations: counts.open,
    unread: counts.unread,
    "by-request": counts.byRequest,
  };

  return (
    <>
      <div className="shrink-0 px-4 pb-3.5 pt-5">
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {/* The screen is named on the bar above this panel, so the rail
                names itself instead of saying "Messages" a second time within
                an inch of the first — and at the size of a rail heading rather
                than of a page title, which is no longer what it is. */}
            <h2 className="text-[15px] font-bold leading-none">Conversations</h2>
            <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
              {counts.open === 0
                ? "Nothing open"
                : `${counts.open} open${counts.unread ? ` · ${counts.unread} unread` : ""}`}
            </p>
          </div>
          {newHref ? (
            <Link
              href={newHref}
              aria-label="New conversation"
              title="New conversation"
              className="cp-press flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-[18px] font-medium leading-none text-white no-underline hover:text-white"
              style={{ background: "var(--accent)" }}
            >
              +
            </Link>
          ) : null}
        </div>

        <label
          className="mb-3 flex items-center gap-2 rounded-full border px-3 py-[7px] transition-[border-color,box-shadow] duration-200 focus-within:border-[color-mix(in_srgb,var(--accent)_45%,transparent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
          style={{ background: "var(--surface-soft)", borderColor: "var(--chat-line)" }}
        >
          <span className="shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }} aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="min-w-0 flex-1 border-none bg-transparent text-[13px] outline-none [&::-webkit-search-cancel-button]:hidden"
            style={{ color: "var(--ink)" }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="shrink-0 text-[13px] leading-none"
              style={{ color: "var(--text-tertiary)" }}
            >
              ×
            </button>
          ) : null}
        </label>

        {requestOptions.length > 0 ? (
          <select
            value={request}
            aria-label="Filter by Request"
            onChange={(event) => setRequest(event.target.value)}
            className="mb-3 w-full rounded-control border px-2.5 py-[7px] text-[12.5px]"
            style={{
              background: "var(--chat-field)",
              borderColor: "var(--chat-line)",
              color: "var(--ink)",
            }}
          >
            <option value="">Any Request</option>
            {requestOptions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        ) : null}

        <nav
          aria-label="Direct or group"
          className="mb-3.5 flex rounded-[8px] p-0.5"
          style={{ background: "var(--chat-ground)" }}
        >
          {(["direct", "group"] as const).map((option) => (
            <KindLink
              key={option}
              href={messagesHref({ kind: option, q, request: request || undefined })}
              label={option === "direct" ? "Direct" : "Group"}
              active={option === kind}
              unread={option !== kind && counts.unreadElsewhere}
            />
          ))}
        </nav>

        {/* Chips across the top, the shape everybody reads in a chat client.
            A count only where there is something to count. */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((option) => (
            <ChipLink
              key={option.key}
              href={link({ tab: option.key })}
              label={option.label}
              active={option.key === tab}
              count={chipCount[option.key]}
              urgent={option.key === "unread"}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          "cp-chat-scroll min-h-0 flex-1 overflow-y-auto border-t",
          visible.length === 0 && "flex items-center justify-center px-5",
        )}
        style={{ borderColor: "var(--chat-line)" }}
      >
        {visible.length === 0 ? (
          <RailEmpty
            searching={Boolean(needle) || Boolean(request)}
            tab={tab}
            kind={kind}
            mayStart={Boolean(newHref)}
            onClear={() => {
              setQuery("");
              setRequest("");
            }}
          />
        ) : (
          groups.map(([title, rows]) => (
            <div key={title ?? "all"}>
              {title ? (
                <div
                  className="truncate border-b px-4 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[.05em]"
                  style={{ color: "var(--text-faint)", borderColor: "var(--chat-line)" }}
                >
                  {title}
                </div>
              ) : null}
              <ul>
                {rows.map((thread) => (
                  <li key={thread.id}>
                    <Row
                      thread={thread}
                      href={link({ thread: thread.id })}
                      active={thread.id === activeId}
                      // Under a By Request heading the heading already names
                      // the Request, and repeating it on every row says nothing.
                      showRequest={tab !== "by-request"}
                      onWarm={() => warm(thread.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function KindLink({
  href,
  label,
  active,
  unread,
}: {
  href: string;
  label: string;
  active: boolean;
  unread: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex min-w-0 flex-1 rounded-[6px] no-underline outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
    >
      <KindFace label={label} active={active} unread={unread} />
    </Link>
  );
}

/** The segment, answering a press before the view it opens has arrived. */
function KindFace({ label, active, unread }: { label: string; active: boolean; unread: boolean }) {
  const { pending } = useLinkStatus();
  const on = active || pending;

  return (
    <span
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-[6px] py-1.5 text-center text-[12.5px] transition-[background-color,box-shadow,color] duration-150",
        on ? "font-semibold" : "font-medium",
      )}
      style={
        on
          ? {
              background: "var(--chat-field)",
              color: "var(--ink)",
              boxShadow: "0 1px 2px rgb(var(--shade-rgb) / .18)",
            }
          : { color: "var(--text-secondary)" }
      }
    >
      {label}
      {/* Something said on the tab you are not looking at. */}
      {unread ? <UnreadDot /> : null}
    </span>
  );
}

function ChipLink({
  href,
  label,
  active,
  count,
  urgent,
}: {
  href: string;
  label: string;
  active: boolean;
  count: number;
  urgent: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-full no-underline outline-none focus-visible:shadow-[0_0_0_2px_var(--accent)]"
    >
      <ChipFace label={label} active={active} count={count} urgent={urgent} />
    </Link>
  );
}

function ChipFace({
  label,
  active,
  count,
  urgent,
}: {
  label: string;
  active: boolean;
  count: number;
  urgent: boolean;
}) {
  const { pending } = useLinkStatus();
  const on = active || pending;

  return (
    <span
      className={cn(
        "block rounded-full border px-2.5 py-[5px] text-[12px] transition-colors",
        on ? "font-semibold" : "font-medium hover:bg-[var(--surface-active)]",
      )}
      style={{
        borderColor: on ? "var(--accent)" : "var(--chat-line)",
        background: on ? "var(--accent-tint)" : "var(--chat-field)",
        color: on ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      {label}
      {count > 0 ? (
        <span
          className="ml-1 font-bold tabular-nums"
          style={{ color: urgent && !on ? "var(--danger-solid)" : "inherit" }}
        >
          {count}
        </span>
      ) : null}
    </span>
  );
}

function Row({
  thread,
  href,
  active,
  showRequest,
  onWarm,
}: {
  thread: MessageThread;
  href: string;
  active: boolean;
  showRequest: boolean;
  onWarm: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={onWarm}
      onPointerDown={onWarm}
      onFocus={onWarm}
      aria-current={active ? "true" : undefined}
      className="group block no-underline outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]"
      style={{ color: "var(--ink)" }}
    >
      <RowBody thread={thread} active={active} showRequest={showRequest} />
    </Link>
  );
}

/**
 * Inside the link, so it can see the link's own navigation: the row that was
 * pressed takes the selected look at once, so the click is answered before the
 * conversation is.
 *
 * A group leads with its own name and says how many are in it; a direct row
 * leads with the one person it is with — the two shapes Whitby's rail draws.
 *
 * THREE LINES, NOT FIVE
 *
 * Every row used to stack the name, the subject, the preview and an unlabelled
 * title of its own, so eight words of conversation filled the rail and two
 * threads were a scroll. The subject now rides the name line in brackets, and
 * the Request is a tagged chip rather than a line that looked like a second
 * subject.
 */
function RowBody({
  thread,
  active,
  showRequest,
}: {
  thread: MessageThread;
  active: boolean;
  showRequest: boolean;
}) {
  const { pending } = useLinkStatus();
  const selected = active || pending;
  const surface = selected ? "var(--accent-tint-mid)" : "var(--surface)";
  const when = relativeTime(thread.lastMessageAt);
  const tag = showRequest && thread.requestTitle ? thread.requestTitle : null;
  const aside = bracketedSubject(thread, showRequest);

  return (
    <span
      className={cn(
        "block border-b px-4 py-2.5 transition-colors duration-150",
        !selected && "group-hover:bg-[var(--surface-active)]",
      )}
      style={{ background: selected ? surface : undefined, borderColor: "var(--chat-line)" }}
    >
      {isGroup(thread) ? (
        <span className="flex items-start gap-2.5">
          <Face name={thread.subject} size={32} />

          <span className="block min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span
                className="min-w-0 flex-1 truncate text-[13.5px]"
                style={{ fontWeight: thread.unread ? 700 : 600 }}
              >
                {thread.subject}
              </span>
              {thread.unread ? <UnreadDot /> : null}
              <Time unread={thread.unread} strong>
                {when}
              </Time>
            </span>

            <Preview thread={thread} className="mt-[3px]" />

            <span className="mt-1.5 flex min-w-0 items-center gap-1.5">
              {tag ? <RequestTag title={tag} /> : null}
              {/* Everyone else, and you. */}
              <Tag>{thread.participants.length + 1} members</Tag>
            </span>
          </span>
        </span>
      ) : (
        <span className="flex items-start gap-2.5">
          {/* The unread mark sits on the face it is with. */}
          <span className="relative shrink-0">
            <Face name={counterpartyOf(thread)} photo={thread.counterpartyPhoto} size={32} />
            {thread.unread ? (
              <span className="absolute -right-px -top-px">
                <UnreadDot ring={surface} />
              </span>
            ) : null}
          </span>

          <span className="block min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              {/* Name and subject truncate as one line, so a long subject
                  cannot push the person it is with off the row. */}
              <span
                className="min-w-0 truncate text-[13.5px]"
                style={{ fontWeight: thread.unread ? 600 : 500 }}
              >
                {counterpartyOf(thread)}
                {aside ? (
                  <span className="font-normal" style={{ color: "var(--text-tertiary)" }}>
                    {" "}
                    ({aside})
                  </span>
                ) : null}
              </span>
              <Time unread={false}>{when}</Time>
            </span>

            <Preview thread={thread} className="mt-[3px]" />

            {tag ? <RequestTag title={tag} className="mt-1.5" /> : null}
          </span>
        </span>
      )}
    </span>
  );
}

const TAG_SHELL =
  "flex w-fit min-w-0 max-w-full items-center gap-1 rounded-full border py-[1.5px] text-[10.5px] leading-[1.4]";

/**
 * Which Request the conversation belongs to.
 *
 * It used to be the bare title in a grey outline, which read as a second
 * subject — "Test Playbook" under "testing" says nothing about what either one
 * is. The mark and the word name it, and the accent separates it from the
 * words of the conversation above it.
 */
function RequestTag({ title, className }: { title: string; className?: string }) {
  return (
    <span
      title={`Request: ${title}`}
      className={cn(TAG_SHELL, "pl-[6px] pr-2", className)}
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 22%, transparent)",
        background: "var(--accent-tint)",
        color: "var(--accent)",
      }}
    >
      <RequestMark />
      <span className="shrink-0 font-semibold uppercase tracking-[.05em]">Request</span>
      <span className="shrink-0 opacity-40" aria-hidden>
        ·
      </span>
      <span className="min-w-0 truncate font-medium" style={{ color: "var(--text-secondary)" }}>
        {title}
      </span>
    </span>
  );
}

/** The quiet counterpart, for anything that is not a Request. */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(TAG_SHELL, "shrink-0 px-2")}
      style={{ color: "var(--text-tertiary)", borderColor: "var(--chat-line)" }}
    >
      {children}
    </span>
  );
}

/** A luggage tag: what a Request looks like everywhere the portal marks one. */
function RequestMark() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden className="shrink-0">
      <path
        d="M1.6 5.4V2.3a.7.7 0 0 1 .7-.7h3.1l5 5a.7.7 0 0 1 0 1L7.7 10.4a.7.7 0 0 1-1 0l-5.1-5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="3.9" cy="3.9" r=".85" fill="currentColor" />
    </svg>
  );
}

function Time({
  unread,
  strong,
  children,
}: {
  unread: boolean;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className="shrink-0 text-[11px]"
      style={{
        color: unread && strong ? "var(--danger-solid)" : "var(--text-tertiary)",
        fontWeight: unread && strong ? 600 : undefined,
      }}
      suppressHydrationWarning
    >
      {children}
    </span>
  );
}

/**
 * The last thing said. If it was yours, a tick says whether they have opened
 * it — which is how a chat list tells you whether you are waiting on a reply or
 * they are.
 */
function Preview({ thread, className }: { thread: MessageThread; className?: string }) {
  return (
    <span
      className={cn("flex items-center gap-1 text-[12.5px]", className)}
      style={{ color: "var(--text-tertiary)" }}
    >
      {thread.lastMine ? (
        <span
          className="shrink-0"
          style={{ color: thread.othersReadAt ? "var(--accent)" : "var(--text-disabled)" }}
          title={thread.othersReadAt ? "Read" : "Sent. Not opened yet."}
        >
          {thread.othersReadAt ? "✓✓" : "✓"}
          <span className="sr-only">{thread.othersReadAt ? " Read" : " Sent"}</span>
        </span>
      ) : null}
      <span className="min-w-0 truncate">{thread.preview || "No messages yet"}</span>
    </span>
  );
}

/** Something said since you last opened it — the same red the bell counts. */
function UnreadDot({ ring }: { ring?: string }) {
  return (
    <span
      aria-label="Unread"
      title="New message"
      className="h-[9px] w-[9px] shrink-0 rounded-full"
      style={{
        background: "var(--danger-solid)",
        border: ring ? `2px solid ${ring}` : undefined,
        boxSizing: "content-box",
      }}
    />
  );
}

function RailEmpty({
  searching,
  tab,
  kind,
  mayStart,
  onClear,
}: {
  searching: boolean;
  tab: RailTab;
  kind: RailKind;
  mayStart: boolean;
  onClear: () => void;
}) {
  const copy = searching
    ? { title: "Nothing matches that", detail: "No conversation here mentions that. Clear the search to see the rest." }
    : tab === "unread"
      ? { title: "Nothing unread", detail: "Everything your team has sent you has been read." }
      : tab === "by-request"
        ? { title: "Nothing linked to a Request", detail: "Conversations about a Request are listed under it here." }
        : kind === "group"
          ? {
              title: "No group conversations yet",
              detail: "A conversation with more than one person from your team shows here.",
            }
          : {
              title: "No conversations yet",
              detail: mayStart
                ? "Start one whenever you have something to ask."
                : "Your team can start one from any request.",
            };

  return (
    <div className="cp-fade-up flex flex-col items-center gap-2.5 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-[14px] text-[18px]"
        style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        aria-hidden
      >
        ✉
      </div>
      <div className="text-[13.5px] font-semibold">{copy.title}</div>
      <div className="text-[12.5px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
        {copy.detail}
      </div>
      {searching ? (
        <button
          type="button"
          onClick={onClear}
          className="cp-press rounded-full px-3 py-1 text-[12.5px] font-medium hover:bg-[var(--surface-active)]"
          style={{ color: "var(--accent)" }}
        >
          Clear search
        </button>
      ) : null}
    </div>
  );
}

function group(threads: MessageThread[]) {
  const groups = new Map<string, MessageThread[]>();
  for (const thread of threads) {
    const key = thread.requestTitle ?? "Not linked to a request";
    const bucket = groups.get(key) ?? [];
    bucket.push(thread);
    groups.set(key, bucket);
  }
  return groups;
}
