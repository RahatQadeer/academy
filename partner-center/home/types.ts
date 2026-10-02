import type { PayoutGate } from "@/partner-center/lib/payout-gate";

export type HomeTab = "overview" | "action" | "activity";

export type ReferralCounts = {
  referred: number;
  inProgress: number;
  converted: number;
  total: number;
};

export type OpportunityCounts = {
  submitted: number;
  inProgress: number;
  converted: number;
  total: number;
};

export type EarningsTotals = {
  pending: number;
  payable: number;
  /** Exception-state total — never merged into payable (SRS §17.7.7). */
  held: number;
  paid: number;
};

export type ProgramRow = {
  key: "academy" | "platform" | "enterprise";
  label: string;
  active: boolean;
  rateLabel: string;
};

export type ActionNeededItem = {
  id: string;
  category: "payout" | "document" | "setup" | "message";
  title: string;
  detail?: string;
  href: string;
  cta: string;
};

export type ActivityItem = {
  id: string;
  at: string;
  label: string;
  /** Segments with optional bold emphasis for entity names */
  parts: { text: string; bold?: boolean }[];
};

export type HomeDashboard = {
  companyName: string;
  payoutGate: PayoutGate;
  referralCounts: ReferralCounts;
  opportunityCounts: OpportunityCounts;
  earnings: EarningsTotals;
  earningsTermsLine: string;
  programs: ProgramRow[];
  actions: ActionNeededItem[];
  activity: ActivityItem[];
  loadWarnings?: string[];
};

export function parseHomeTab(value: string | string[] | undefined): HomeTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "action" || raw === "activity") return raw;
  return "overview";
}
