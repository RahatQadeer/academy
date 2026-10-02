"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/base/components/Logo";
import { AskChatMenu } from "@/whitbyos/ask/components/AskChatMenu";
import { askThreadLabel } from "@/whitbyos/lib/ask-format";
import type { AskThreadRow } from "@/whitbyos/lib/ask-threads";

const STORAGE_KEY = "pa-ask-rail-collapsed";

export function AskRail({
  threads,
  threadId,
}: {
  threads: AskThreadRow[];
  threadId?: string;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [focusSearch, setFocusSearch] = useState(false);
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (collapsed || !focusSearch) return;
    searchRef.current?.focus();
    setFocusSearch(false);
  }, [collapsed, focusSearch]);

  function persist(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  const needle = query.trim().toLowerCase();
  const live = threads.filter((thread) => !removed[thread.id]);
  const shown = needle
    ? live.filter((thread) => askThreadLabel(thread.title).toLowerCase().includes(needle))
    : live;

  function hideThread(id: string) {
    setRemoved((was) => ({ ...was, [id]: true }));
    if (id === threadId) router.replace("/whitbyos/ask");
  }

  if (collapsed) {
    return (
      <aside className="ask-rail flex w-[64px] shrink-0 flex-col items-center gap-1 py-3">
        <span className="mb-1 flex h-9 w-9 overflow-hidden rounded-[9px]" aria-hidden>
          <Logo size={36} />
        </span>
        <RailIcon label="Open sidebar" onClick={() => persist(false)}>
          <PanelIcon />
        </RailIcon>
        <RailIcon label="New chat" href="/whitbyos/ask">
          <ComposeIcon />
        </RailIcon>
        <RailIcon
          label="Search chats"
          onClick={() => {
            persist(false);
            setFocusSearch(true);
          }}
        >
          <SearchIcon />
        </RailIcon>
      </aside>
    );
  }

  return (
    /* Out of the way below `lg`: 268px of rail on a phone leaves 122px of
       conversation, and the conversation is the screen. The rail is still
       reachable full screen, where it has the room to be a rail. */
    <aside className="ask-rail hidden w-[268px] shrink-0 flex-col lg:flex">
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 px-3">
        <span className="flex h-8 w-8 overflow-hidden rounded-[8px]" aria-hidden>
          <Logo size={32} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          Ask Whitby
        </span>
        <RailIcon label="Close sidebar" onClick={() => persist(true)} compact>
          <PanelIcon />
        </RailIcon>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-3">
        <Link href="/whitbyos/ask" className="ask-rail-new no-underline">
          <ComposeIcon />
          New chat
        </Link>
        <label className="relative block">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-quiet)" }}
          >
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
            placeholder="Search chats"
            aria-label="Search chats"
            autoComplete="off"
            className="ws-rail-search-field w-full rounded-control py-2 pl-9 pr-3 text-[13px] outline-none"
          />
        </label>
      </div>

      <p className="ask-rail-heading px-4 pb-1.5 pt-3">Recents</p>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {shown.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] leading-[1.45]" style={{ color: "var(--text-tertiary)" }}>
            {needle ? "No chats match." : "Nothing here yet. Ask from Home or start a chat."}
          </p>
        ) : (
          shown.map((thread) => {
            const on = thread.id === threadId;
            return (
              <div key={thread.id} className={`ask-recent group mb-0.5 ${on ? "is-on" : ""}`}>
                <Link
                  href={`/whitbyos/ask/${thread.id}`}
                  className="ask-recent-link min-w-0 flex-1 truncate px-2.5 py-[7px] text-[13px] no-underline"
                >
                  {askThreadLabel(thread.title)}
                </Link>
                <AskChatMenu
                  threadId={thread.id}
                  title={thread.title}
                  onDeleted={hideThread}
                />
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function RailIcon({
  label,
  href,
  onClick,
  children,
  compact,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  compact?: boolean;
}) {
  const className = compact
    ? "relative flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-[var(--canvas)]"
    : "group relative flex h-10 w-10 items-center justify-center rounded-[10px] hover:bg-[var(--canvas)]";
  const style = { color: "var(--text-secondary)" };
  const tip = compact ? null : (
    <span
      className="pointer-events-none absolute left-[calc(100%+10px)] z-40 hidden whitespace-nowrap rounded-[8px] px-3 py-1 text-[12px] font-medium text-white group-hover:block"
      style={{ background: "var(--ink)" }}
    >
      {label}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={`${className} no-underline`} style={style}>
        {children}
        {tip}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={className} style={style}>
      {children}
      {tip}
    </button>
  );
}

function PanelIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 4.5v15" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 20h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M16.5 3.6a2.1 2.1 0 0 1 3 3L8 18.1 4 19l.9-4L16.5 3.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
