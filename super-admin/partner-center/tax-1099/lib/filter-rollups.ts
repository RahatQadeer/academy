import type {
  Partner1099RollupRow,
  Partner1099Status,
} from "@/partner-center/lib/tax/rollup-1099";

export const REPORTABLE_THRESHOLD = 600;

export type RollupStatusFilter =
  | "all"
  | "needs_attention"
  | Partner1099Status;

export type RollupRailFilter =
  | "all"
  | "stripe"
  | "non_stripe"
  | "both"
  | "neither";

export type RollupReportableFilter = "all" | "at_or_above" | "below";
export type RollupReferenceFilter = "all" | "with" | "without";
export type RollupSort =
  | "reportable_desc"
  | "reportable_asc"
  | "name"
  | "status";

export type RollupFilterState = {
  search: string;
  status: RollupStatusFilter;
  rail: RollupRailFilter;
  reportable: RollupReportableFilter;
  reference: RollupReferenceFilter;
  sort: RollupSort;
};

export const DEFAULT_ROLLUP_FILTERS: RollupFilterState = {
  search: "",
  status: "all",
  rail: "all",
  reportable: "all",
  reference: "all",
  sort: "reportable_desc",
};

const STATUS_ORDER: Record<Partner1099Status, number> = {
  not_started: 0,
  in_progress: 1,
  complete: 2,
  filed: 3,
};

function hasReference(row: Partner1099RollupRow): boolean {
  return Boolean(row.reference?.trim());
}

function matchesSearch(row: Partner1099RollupRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [row.companyName, row.reference ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function matchesStatus(
  row: Partner1099RollupRow,
  status: RollupStatusFilter,
): boolean {
  if (status === "all") return true;
  if (status === "needs_attention") {
    return row.status === "not_started" || row.status === "in_progress";
  }
  return row.status === status;
}

function matchesRail(
  row: Partner1099RollupRow,
  rail: RollupRailFilter,
): boolean {
  if (rail === "all") return true;
  const stripe = row.stripePaidTotal > 0;
  const nonStripe = row.quickbooksPaidTotal > 0;
  if (rail === "stripe") return stripe && !nonStripe;
  if (rail === "non_stripe") return nonStripe && !stripe;
  if (rail === "both") return stripe && nonStripe;
  return !stripe && !nonStripe;
}

function matchesReportable(
  row: Partner1099RollupRow,
  reportable: RollupReportableFilter,
): boolean {
  if (reportable === "all") return true;
  if (reportable === "at_or_above") {
    return row.reportableTotal >= REPORTABLE_THRESHOLD;
  }
  return row.reportableTotal < REPORTABLE_THRESHOLD;
}

function matchesReference(
  row: Partner1099RollupRow,
  reference: RollupReferenceFilter,
): boolean {
  if (reference === "all") return true;
  const present = hasReference(row);
  return reference === "with" ? present : !present;
}

function sortRows(
  rows: Partner1099RollupRow[],
  sort: RollupSort,
): Partner1099RollupRow[] {
  const next = [...rows];
  if (sort === "reportable_desc") {
    next.sort((a, b) => {
      if (b.reportableTotal !== a.reportableTotal) {
        return b.reportableTotal - a.reportableTotal;
      }
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  if (sort === "reportable_asc") {
    next.sort((a, b) => {
      if (a.reportableTotal !== b.reportableTotal) {
        return a.reportableTotal - b.reportableTotal;
      }
      return a.companyName.localeCompare(b.companyName);
    });
    return next;
  }
  if (sort === "name") {
    next.sort((a, b) => a.companyName.localeCompare(b.companyName));
    return next;
  }
  next.sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return a.companyName.localeCompare(b.companyName);
  });
  return next;
}

export function applyRollupFilters(
  rows: Partner1099RollupRow[],
  state: RollupFilterState,
): Partner1099RollupRow[] {
  const filtered = rows.filter((row) => {
    if (!matchesSearch(row, state.search)) return false;
    if (!matchesStatus(row, state.status)) return false;
    if (!matchesRail(row, state.rail)) return false;
    if (!matchesReportable(row, state.reportable)) return false;
    if (!matchesReference(row, state.reference)) return false;
    return true;
  });
  return sortRows(filtered, state.sort);
}
