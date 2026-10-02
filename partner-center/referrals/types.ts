export type ReferralStatus =
  | "referred"
  | "in_progress"
  | "converted"
  | "not_converted";

export type ReferralProgramFilter = "all" | "academy" | "platform" | "whitbyos";

export type ReferralDateRange = "all" | "30" | "90";

/** Tab shown in the UI. `referred` status keeps All selected. */
export type ReferralTab =
  | "all"
  | "in_progress"
  | "converted"
  | "not_converted";

export type ReferralListFilters = {
  status: ReferralStatus | "all";
  program: ReferralProgramFilter;
  range: ReferralDateRange;
  q: string;
};

export type ReferralListItem = {
  id: string;
  displayId: string;
  contactName: string | null;
  companyName: string | null;
  program: "academy" | "platform" | string;
  product: string | null;
  source: string | null;
  sourceLabel: string;
  referralDate: string;
  conversionDate: string | null;
  status: ReferralStatus | string;
};

export type ReferralListData = {
  items: ReferralListItem[];
  /** True when the partner has zero referrals at all (ignore filters). */
  isEmpty: boolean;
  /** Existing partner_links_codes referral_link code, if any. */
  referralCode: string | null;
  filters: ReferralListFilters;
  activeTab: ReferralTab;
};

export type ReferralTimelineItem = {
  id: string;
  dateLabel: string;
  /** ISO stamp used for ordering newest-first. */
  at: string;
  parts: { text: string; bold?: boolean }[];
};

export type ReferralEarningSummary = {
  rateLabel: string;
  basisLabel: string;
  amount: number;
  status: string;
  statusLabel: string;
  /** From partner_commission_rules.payment_terms when present. */
  paymentTerms: string | null;
};

export type ReferralDetail = {
  id: string;
  displayId: string;
  title: string;
  status: ReferralStatus | string;
  contactName: string | null;
  companyName: string | null;
  /** True when company was resolved via the referred contact's company_contacts link. */
  companyViaContact: boolean;
  referredUserId: string | null;
  referredUserLabel: string | null;
  program: string;
  programLabel: string;
  product: string | null;
  sourceLabel: string;
  sourceDetail: string | null;
  referralDateLabel: string;
  attributionWindowLabel: string;
  conversionDateLabel: string | null;
  timeline: ReferralTimelineItem[];
  /** True when at least one partner_attribution_events row exists for this referral. */
  hasAttributionEvents: boolean;
  earning: ReferralEarningSummary | null;
};

export function parseReferralStatus(
  value: string | string[] | undefined,
): ReferralStatus | "all" {
  const raw = typeof value === "string" ? value : undefined;
  if (
    raw === "referred" ||
    raw === "in_progress" ||
    raw === "converted" ||
    raw === "not_converted"
  ) {
    return raw;
  }
  return "all";
}

export function parseReferralProgram(
  value: string | string[] | undefined,
): ReferralProgramFilter {
  const raw = typeof value === "string" ? value : undefined;
  if (raw === "academy" || raw === "platform" || raw === "whitbyos") return raw;
  return "all";
}

export function parseReferralRange(
  value: string | string[] | undefined,
): ReferralDateRange {
  const raw = typeof value === "string" ? value : undefined;
  if (raw === "30" || raw === "90") return raw;
  return "all";
}

export function parseReferralQuery(
  value: string | string[] | undefined,
): string {
  return typeof value === "string" ? value.trim() : "";
}

export function tabFromStatus(status: ReferralStatus | "all"): ReferralTab {
  if (
    status === "in_progress" ||
    status === "converted" ||
    status === "not_converted"
  ) {
    return status;
  }
  return "all";
}

export function parseListFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): ReferralListFilters {
  return {
    status: parseReferralStatus(searchParams?.status),
    program: parseReferralProgram(searchParams?.program),
    range: parseReferralRange(searchParams?.range),
    q: parseReferralQuery(searchParams?.q),
  };
}
