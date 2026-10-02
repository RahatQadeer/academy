import type { PayoutGate } from "@/partner-center/lib/payout-gate";
import type { FieldStatusCopy } from "@/partner-center/earnings/lib/payout-status";

export type EarningStatus =
  | "pending"
  | "approved"
  | "payable"
  | "paid"
  | "held"
  | "reversed"
  | "ineligible";

/** URL/filter key. `pending` includes `approved` (Home KPI bucket). */
export type EarningsStatusFilter = "all" | "pending" | "payable" | "paid" | "held" | "reversed" | "ineligible";

export type EarningsTotals = {
  pending: number;
  payable: number;
  held: number;
  paid: number;
  reversed: number;
};

export type ProgramRateRow = {
  key: "academy" | "platform" | "enterprise";
  label: string;
  active: boolean;
  rateLabel: string;
};

export type PaymentTermsSummary = {
  schedule: string;
  eligiblePeriod: string;
  nextPayout: string;
};

export type EarningsListItem = {
  id: string;
  displayId: string;
  sourceLabel: string;
  programLabel: string;
  basisLabel: string;
  rateLabel: string;
  amount: number;
  status: string;
};

export type EarningsOverview = {
  totals: EarningsTotals;
  paidPayoutCount: number;
  payoutGate: PayoutGate;
  programs: ProgramRateRow[];
  paymentTerms: PaymentTermsSummary;
  items: EarningsListItem[];
  /** True when the partner has zero earnings at all (ignore filters). */
  isEmpty: boolean;
  statusFilter: EarningsStatusFilter;
};

export type CollectedPaymentRow = {
  id: string;
  dateLabel: string;
  collectedLabel: string;
  commission: number;
  status: string;
};

export type AdjustmentRow = {
  id: string;
  dateLabel: string;
  type: string;
  amountDelta: number;
  reason: string | null;
};

export type EarningLedger = {
  id: string;
  displayId: string;
  title: string;
  status: string;
  totalEarned: number;
  programLabel: string;
  rateLabel: string;
  basisLabel: string;
  eligiblePeriod: string;
  paymentTerms: string;
  sourceLabel: string;
  payments: CollectedPaymentRow[];
  adjustments: AdjustmentRow[];
  payoutGate: PayoutGate;
  taxProfile: FieldStatusCopy;
  paymentSetup: FieldStatusCopy;
};

const STATUS_FILTERS: EarningsStatusFilter[] = [
  "all",
  "pending",
  "payable",
  "paid",
  "held",
  "reversed",
  "ineligible",
];

export function parseEarningsStatus(
  value: string | string[] | undefined,
): EarningsStatusFilter {
  const raw = typeof value === "string" ? value : undefined;
  if (raw && STATUS_FILTERS.includes(raw as EarningsStatusFilter)) {
    return raw as EarningsStatusFilter;
  }
  return "all";
}

export function matchesStatusFilter(
  status: string,
  filter: EarningsStatusFilter,
): boolean {
  // Default list: real commission outcomes only. $0 ineligible rows stay on
  // the Ineligible tab for audit (one-payment / first-payment rule).
  if (filter === "all") return status !== "ineligible";
  if (filter === "pending") return status === "pending" || status === "approved";
  return status === filter;
}
