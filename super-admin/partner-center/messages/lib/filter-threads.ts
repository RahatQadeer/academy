import type { AdminMessageThreadItem } from "@/super-admin/partner-center/messages/types";

export type InboxTriage = "all" | "needs_reply" | "unread" | "waiting";
export type InboxStatus = "all" | "approved" | "active";
export type InboxSort = "unread" | "newest" | "oldest" | "name";

export type InboxFilterState = {
  search: string;
  triage: InboxTriage;
  status: InboxStatus;
  sort: InboxSort;
};

export const DEFAULT_INBOX_FILTERS: InboxFilterState = {
  search: "",
  triage: "all",
  status: "all",
  sort: "unread",
};

function matchesSearch(item: AdminMessageThreadItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    item.companyName,
    item.contactName,
    item.contactEmail,
    item.lastBody ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function matchesTriage(item: AdminMessageThreadItem, triage: InboxTriage): boolean {
  if (triage === "all") return true;
  if (triage === "needs_reply") return item.needsReply;
  if (triage === "unread") return item.unreadFromPartner;
  // waiting on partner: staff spoke last and there is a thread
  return item.messageCount > 0 && item.lastSenderType === "staff";
}

function compareByLastSent(
  a: AdminMessageThreadItem,
  b: AdminMessageThreadItem,
  ascending: boolean,
): number {
  if (a.lastSentAt && b.lastSentAt) {
    const cmp = a.lastSentAt.localeCompare(b.lastSentAt);
    return ascending ? cmp : -cmp;
  }
  if (a.lastSentAt) return -1;
  if (b.lastSentAt) return 1;
  return 0;
}

function sortItems(
  items: AdminMessageThreadItem[],
  sort: InboxSort,
): AdminMessageThreadItem[] {
  const next = [...items];
  if (sort === "unread") {
    next.sort((a, b) => {
      if (a.unreadFromPartner !== b.unreadFromPartner) {
        return a.unreadFromPartner ? -1 : 1;
      }
      const byDate = compareByLastSent(a, b, false);
      if (byDate !== 0) return byDate;
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  if (sort === "newest") {
    next.sort((a, b) => {
      const byDate = compareByLastSent(a, b, false);
      if (byDate !== 0) return byDate;
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  if (sort === "oldest") {
    next.sort((a, b) => {
      const byDate = compareByLastSent(a, b, true);
      if (byDate !== 0) return byDate;
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  next.sort((a, b) => a.companyName.localeCompare(b.companyName));
  return next;
}

export function applyInboxFilters(
  items: AdminMessageThreadItem[],
  state: InboxFilterState,
): AdminMessageThreadItem[] {
  const filtered = items.filter((item) => {
    if (item.messageCount === 0) return false;
    if (!matchesSearch(item, state.search)) return false;
    if (!matchesTriage(item, state.triage)) return false;
    if (state.status !== "all" && item.status !== state.status) {
      return false;
    }
    return true;
  });

  return sortItems(filtered, state.sort);
}
