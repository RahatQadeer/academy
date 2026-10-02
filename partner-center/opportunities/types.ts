export type OpportunityStatus =
  | "submitted"
  | "accepted"
  | "in_progress"
  | "converted"
  | "not_moving_forward";

/** Stored slug for product interest — values come from Admin config (§17.6.6). */
export type ProductInterest = string;

/** Tab shown in the UI. Closed maps to `not_moving_forward`. */
export type OpportunityTab =
  | "all"
  | "submitted"
  | "accepted"
  | "in_progress"
  | "converted"
  | "closed";

/** Composite filter for Home drill-down (accepted + in_progress). */
export type OpportunityCompositeStatus = "accepted_in_progress";

export type OpportunityListFilters = {
  status: OpportunityStatus | OpportunityCompositeStatus | "all";
};

export type OpportunityListItem = {
  id: string;
  companyName: string;
  contactName: string | null;
  contactTitle: string | null;
  productInterest: string | null;
  estimatedSeats: number | null;
  estimatedValue: number | null;
  submittedAt: string;
  protectedUntil: string | null;
  status: OpportunityStatus | string;
};

export type OpportunityListData = {
  items: OpportunityListItem[];
  /** True when the partner has zero opportunities at all. */
  isEmpty: boolean;
  /** False for read-only team members — hide submit CTAs. */
  canSubmit: boolean;
  filters: OpportunityListFilters;
  activeTab: OpportunityTab;
  productInterestOptions: Array<{ value: string; label: string }>;
};

export type OpportunityTimelineItem = {
  id: string;
  dateLabel: string;
  /** ISO stamp used for ordering newest-first. */
  at: string;
  parts: { text: string; bold?: boolean }[];
};

export type OpportunityDetail = {
  id: string;
  companyName: string;
  website: string | null;
  status: OpportunityStatus | string;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  productInterest: string | null;
  estimatedSeats: number | null;
  estimatedValue: number | null;
  /** Unpacked timing; null when unset — do not render a blank label. */
  expectedTiming: string | null;
  /** Unpacked notes body (additional context). */
  additionalContext: string | null;
  attachment: { id: string; title: string } | null;
  permissionToContact: boolean;
  submittedAt: string;
  submittedLabel: string;
  acceptedAt: string | null;
  acceptedLabel: string | null;
  protectedUntil: string | null;
  protectedUntilLabel: string | null;
  /** True when partner may edit (submitted or accepted). */
  editable: boolean;
  timeline: OpportunityTimelineItem[];
  productInterestOptions: Array<{ value: string; label: string }>;
};

export function parseOpportunityStatus(
  value: string | string[] | undefined,
): OpportunityStatus | OpportunityCompositeStatus | "all" {
  const raw = typeof value === "string" ? value : undefined;
  if (raw === "accepted_in_progress") return raw;
  if (
    raw === "submitted" ||
    raw === "accepted" ||
    raw === "in_progress" ||
    raw === "converted" ||
    raw === "not_moving_forward"
  ) {
    return raw;
  }
  if (raw === "closed") return "not_moving_forward";
  return "all";
}

export function tabFromStatus(
  status: OpportunityStatus | OpportunityCompositeStatus | "all",
): OpportunityTab {
  if (status === "accepted_in_progress") return "all";
  if (status === "not_moving_forward") return "closed";
  if (
    status === "submitted" ||
    status === "accepted" ||
    status === "in_progress" ||
    status === "converted"
  ) {
    return status;
  }
  return "all";
}

export function statusFromTab(tab: OpportunityTab): OpportunityStatus | "all" {
  if (tab === "closed") return "not_moving_forward";
  if (
    tab === "submitted" ||
    tab === "accepted" ||
    tab === "in_progress" ||
    tab === "converted"
  ) {
    return tab;
  }
  return "all";
}

export function parseListFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): OpportunityListFilters {
  return {
    status: parseOpportunityStatus(searchParams?.status),
  };
}

export const EXPECTED_TIMING_OPTIONS = [
  "This quarter",
  "Next quarter",
  "This year",
  "Next year",
  "Flexible / TBD",
] as const;
