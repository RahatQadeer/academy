import {
  resolvePayoutGate,
  type PayoutGate,
} from "@/partner-center/lib/payout-gate";
import type { PayablePartnerListItem } from "@/super-admin/partner-center/types";

export type PayableGateFilter =
  | "all"
  | "ready"
  | "needs_tax_setup"
  | "needs_payment_setup"
  | "on_hold";

export type PayableMethodFilter =
  | "all"
  | "stripe_connect"
  | "quickbooks"
  | "ach"
  | "check"
  | "unset";

export type PayableSort = "payable_desc" | "payable_asc" | "name";

export type PayableFilterState = {
  search: string;
  gate: PayableGateFilter;
  method: PayableMethodFilter;
  sort: PayableSort;
};

export const DEFAULT_PAYABLE_FILTERS: PayableFilterState = {
  search: "",
  gate: "all",
  method: "all",
  sort: "payable_desc",
};

export type EnabledPayoutMethods = {
  stripeEnabled: boolean;
  quickbooksEnabled: boolean;
  achEnabled: boolean;
  checkEnabled: boolean;
};

function itemGate(item: PayablePartnerListItem): PayoutGate {
  return resolvePayoutGate({
    payout_eligibility: item.payoutEligibility,
    tax_profile_status: item.taxProfileStatus,
    payment_setup_status: item.paymentSetupStatus,
  });
}

export function canRunAnyPayout(
  item: PayablePartnerListItem,
  enabled: EnabledPayoutMethods,
): boolean {
  const gate = itemGate(item);
  if (gate !== "eligible" || item.payableTotal <= 0) return false;
  if (enabled.stripeEnabled && item.stripeConnected) return true;
  if (enabled.quickbooksEnabled) return true;
  if (enabled.achEnabled) return true;
  if (enabled.checkEnabled) return true;
  return false;
}

function matchesSearch(item: PayablePartnerListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.companyName.toLowerCase().includes(q);
}

function matchesGate(
  item: PayablePartnerListItem,
  gate: PayableGateFilter,
  enabled: EnabledPayoutMethods,
): boolean {
  if (gate === "all") return true;
  if (gate === "ready") return canRunAnyPayout(item, enabled);
  return itemGate(item) === gate;
}

function matchesMethod(
  item: PayablePartnerListItem,
  method: PayableMethodFilter,
): boolean {
  if (method === "all") return true;
  if (method === "unset") return !item.preferredPayoutMethod;
  return item.preferredPayoutMethod === method;
}

function sortItems(
  items: PayablePartnerListItem[],
  sort: PayableSort,
): PayablePartnerListItem[] {
  const next = [...items];
  if (sort === "payable_desc") {
    next.sort((a, b) => {
      if (b.payableTotal !== a.payableTotal) {
        return b.payableTotal - a.payableTotal;
      }
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  if (sort === "payable_asc") {
    next.sort((a, b) => {
      if (a.payableTotal !== b.payableTotal) {
        return a.payableTotal - b.payableTotal;
      }
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  next.sort((a, b) => a.companyName.localeCompare(b.companyName));
  return next;
}

export function applyPayableFilters(
  items: PayablePartnerListItem[],
  state: PayableFilterState,
  enabled: EnabledPayoutMethods,
): PayablePartnerListItem[] {
  const filtered = items.filter((item) => {
    if (!matchesSearch(item, state.search)) return false;
    if (!matchesGate(item, state.gate, enabled)) return false;
    if (!matchesMethod(item, state.method)) return false;
    return true;
  });

  return sortItems(filtered, state.sort);
}
