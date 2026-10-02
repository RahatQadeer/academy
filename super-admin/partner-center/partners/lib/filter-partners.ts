import type { PartnerListItem } from "@/super-admin/partner-center/types";

export type PartnerStatusFilter = "all" | "active" | "approved";

export type PartnerFilterState = {
  search: string;
  status: PartnerStatusFilter;
};

export const DEFAULT_PARTNER_FILTERS: PartnerFilterState = {
  search: "",
  status: "all",
};

function matchesSearch(item: PartnerListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [item.companyName, item.contactName, item.contactEmail]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function applyPartnerFilters(
  items: PartnerListItem[],
  state: PartnerFilterState,
): PartnerListItem[] {
  return items.filter((item) => {
    if (!matchesSearch(item, state.search)) return false;
    if (state.status !== "all" && item.status !== state.status) return false;
    return true;
  });
}
