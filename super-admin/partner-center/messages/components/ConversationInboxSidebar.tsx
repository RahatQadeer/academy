"use client";

import { useDeferredValue, useState } from "react";
import { ConversationList } from "@/super-admin/partner-center/messages/components/ConversationList";
import { InboxFilters } from "@/super-admin/partner-center/messages/components/InboxFilters";
import {
  applyInboxFilters,
  DEFAULT_INBOX_FILTERS,
  type InboxFilterState,
} from "@/super-admin/partner-center/messages/lib/filter-threads";
import type { AdminMessageThreadItem } from "@/super-admin/partner-center/messages/types";

export function ConversationInboxSidebar({
  items,
  selectedProfileId,
  unreadCount = 0,
}: {
  items: AdminMessageThreadItem[];
  selectedProfileId: string | null;
  unreadCount?: number;
}) {
  const [filters, setFilters] = useState<InboxFilterState>(DEFAULT_INBOX_FILTERS);
  const deferredSearch = useDeferredValue(filters.search);
  const filtered = applyInboxFilters(items, {
    ...filters,
    search: deferredSearch,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-4 pb-3 pt-5">
        <h1 className="text-[20px] font-bold leading-none tracking-[-0.3px]">Messages</h1>
        {unreadCount > 0 ? (
          <p
            className="mt-1.5 text-[11.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {unreadCount} unread
          </p>
        ) : (
          <p
            className="mt-1.5 text-[11.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {items.length} conversation{items.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <InboxFilters value={filters} onChange={setFilters} />

      {items.length > 0 && filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          <p
            className="m-0 text-[14px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            No conversations match
          </p>
          <p
            className="m-0 mt-1.5 text-center text-[12.5px] leading-[1.45]"
            style={{ color: "var(--text-secondary)" }}
          >
            Try clearing search or widening the filters.
          </p>
          <button
            type="button"
            className="mt-4 text-[13px]"
            style={{ color: "var(--accent)" }}
            onClick={() => setFilters(DEFAULT_INBOX_FILTERS)}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ConversationList
          items={filtered}
          selectedProfileId={selectedProfileId}
        />
      )}
    </div>
  );
}
