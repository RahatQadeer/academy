"use client";

import { Input } from "@/base/components/Input";
import { cn } from "@/base/lib/cn";
import type {
  InboxFilterState,
  InboxSort,
  InboxStatus,
  InboxTriage,
} from "@/super-admin/partner-center/messages/lib/filter-threads";

const TRIAGE: { key: InboxTriage; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs_reply", label: "Needs reply" },
  { key: "unread", label: "Unread" },
  { key: "waiting", label: "Waiting" },
];

const SELECT_CLASS =
  "min-w-0 flex-1 rounded-[6px] border bg-[var(--chat-field)] px-2 py-1.5 text-[12.5px]";

export function InboxFilters({
  value,
  onChange,
}: {
  value: InboxFilterState;
  onChange: (next: InboxFilterState) => void;
}) {
  function patch<K extends keyof InboxFilterState>(
    key: K,
    next: InboxFilterState[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="shrink-0 space-y-2.5 border-b border-line px-4 pb-3.5">
      <Input
        label="Search conversations"
        labelHidden
        type="search"
        placeholder="Search company, contact, email…"
        value={value.search}
        onChange={(e) => patch("search", e.target.value)}
        className="!py-2 text-[13px]"
      />

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Triage">
        {TRIAGE.map((tab) => {
          const active = value.triage === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => patch("triage", tab.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-[5px] text-[12.5px] transition-colors",
                active ? "font-semibold" : "font-medium",
                !active && "hover:bg-[var(--surface-active)]",
              )}
              style={{
                borderColor: active ? "var(--accent)" : "var(--chrome-line)",
                background: active ? "var(--accent-tint)" : "var(--surface)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="sr-only" htmlFor="inbox-status">
          Status
        </label>
        <select
          id="inbox-status"
          className={SELECT_CLASS}
          style={{ borderColor: "var(--chat-line)", color: "var(--chat-ink)" }}
          value={value.status}
          onChange={(e) => patch("status", e.target.value as InboxStatus)}
        >
          <option value="all">Any status</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
        </select>

        <label className="sr-only" htmlFor="inbox-sort">
          Sort
        </label>
        <select
          id="inbox-sort"
          className={SELECT_CLASS}
          style={{ borderColor: "var(--chat-line)", color: "var(--chat-ink)" }}
          value={value.sort}
          onChange={(e) => patch("sort", e.target.value as InboxSort)}
        >
          <option value="unread">Unread first</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Company A–Z</option>
        </select>
      </div>
    </div>
  );
}
