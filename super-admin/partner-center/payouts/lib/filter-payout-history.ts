import type { PartnerPayoutHistoryItem } from "@/super-admin/partner-center/types";

export type HistoryStatusFilter = "all" | "scheduled" | "paid" | "failed";
export type HistoryMethodFilter =
  | "all"
  | "stripe_connect"
  | "quickbooks"
  | "ach"
  | "check";
export type HistoryDateFilter = "all" | "today" | "7d" | "30d" | "older";
export type HistorySort = "newest" | "oldest" | "amount_desc" | "name";

export type HistoryFilterState = {
  search: string;
  status: HistoryStatusFilter;
  method: HistoryMethodFilter;
  date: HistoryDateFilter;
  sort: HistorySort;
};

export const DEFAULT_HISTORY_FILTERS: HistoryFilterState = {
  search: "",
  status: "all",
  method: "all",
  date: "all",
  sort: "newest",
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function eventDate(item: PartnerPayoutHistoryItem): string {
  return item.paidAt ?? item.createdAt;
}

function matchesDate(
  item: PartnerPayoutHistoryItem,
  date: HistoryDateFilter,
  now: Date,
): boolean {
  if (date === "all") return true;
  const raw = eventDate(item);
  const sent = new Date(raw);
  if (Number.isNaN(sent.getTime())) return false;

  const todayStart = startOfLocalDay(now);
  const ageMs = now.getTime() - sent.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (date === "today") return sent >= todayStart;
  if (date === "7d") return ageMs <= 7 * dayMs;
  if (date === "30d") return ageMs <= 30 * dayMs;
  return ageMs > 30 * dayMs;
}

function matchesSearch(
  item: PartnerPayoutHistoryItem,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [item.companyName, item.reference ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function sortItems(
  items: PartnerPayoutHistoryItem[],
  sort: HistorySort,
): PartnerPayoutHistoryItem[] {
  const next = [...items];
  if (sort === "newest") {
    next.sort((a, b) => eventDate(b).localeCompare(eventDate(a)));
    return next;
  }
  if (sort === "oldest") {
    next.sort((a, b) => eventDate(a).localeCompare(eventDate(b)));
    return next;
  }
  if (sort === "amount_desc") {
    next.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  next.sort((a, b) => a.companyName.localeCompare(b.companyName));
  return next;
}

export function applyHistoryFilters(
  items: PartnerPayoutHistoryItem[],
  state: HistoryFilterState,
  now: Date = new Date(),
): PartnerPayoutHistoryItem[] {
  const filtered = items.filter((item) => {
    if (!matchesSearch(item, state.search)) return false;
    if (state.status !== "all" && item.status !== state.status) return false;
    if (state.method !== "all" && item.method !== state.method) return false;
    if (!matchesDate(item, state.date, now)) return false;
    return true;
  });
  return sortItems(filtered, state.sort);
}
