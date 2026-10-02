import type { TaxPaymentView } from "@/partner-center/settings/lib/load-tax-payment";

export type StatusPillTone = "success" | "warning" | "danger" | "info" | "neutral";

export function formatTaxDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formTypeLabel(formType: string | null | undefined) {
  if (formType === "w9") return "W-9";
  if (formType === "w8") return "W-8";
  if (formType === "other") return "Other";
  return "—";
}

export function collectionSourceLabel(source: string | null | undefined) {
  if (source === "stripe_tax") return "Stripe";
  if (source === "quickbooks_w9") return "QuickBooks";
  if (source === "other") return "Other";
  return "—";
}

export function payoutMethodLabel(method: string | null | undefined) {
  if (method === "stripe_connect") return "Stripe Connect";
  if (method === "quickbooks") return "QuickBooks";
  if (method === "ach") return "ACH";
  if (method === "check") return "Check";
  return "Not selected";
}

export function taxStatusPresentation(status: string): {
  label: string;
  tone: StatusPillTone;
  detail?: string;
} {
  switch (status) {
    case "complete":
      return { label: "Complete", tone: "success" };
    case "needs_attention":
      return { label: "Needs Attention", tone: "warning" };
    case "review_required":
      return {
        label: "Review Required",
        tone: "info",
        detail:
          "Tax classification was unclear from your submission — Private Attaché staff are reviewing it.",
      };
    case "expired":
      return {
        label: "Expired",
        tone: "danger",
        detail:
          "Your on-file tax certification needs to be refreshed to stay current.",
      };
    case "in_progress":
      return { label: "In Progress", tone: "warning" };
    default:
      return {
        label: "Not Started",
        tone: "neutral",
        detail: "Tax profile and payment method haven't been started yet.",
      };
  }
}

export function paymentStatusPresentation(
  paymentSetupStatus: string,
  payoutEligibility: string,
): {
  label: string;
  tone: StatusPillTone;
  statusLine: string;
  eligibilityLine: string;
  eligibilityWarning: boolean;
} {
  if (payoutEligibility === "on_hold" || paymentSetupStatus === "on_hold") {
    return {
      label: "On Hold",
      tone: "danger",
      statusLine: "Stripe flagged an issue with your account",
      eligibilityLine: "Payouts are paused until it's resolved",
      eligibilityWarning: true,
    };
  }
  if (paymentSetupStatus === "ready") {
    return {
      label: "Complete",
      tone: "success",
      statusLine: "Bank details on file",
      eligibilityLine:
        payoutEligibility === "eligible"
          ? "Eligible"
          : payoutEligibility === "needs_tax_setup"
            ? "Blocked until tax profile is complete"
            : "Needs attention",
      eligibilityWarning: payoutEligibility !== "eligible",
    };
  }
  if (paymentSetupStatus === "incomplete") {
    return {
      label: "In progress",
      tone: "warning",
      statusLine: "Finish remaining details in Stripe",
      eligibilityLine: "Payouts unlock when Stripe finishes verifying",
      eligibilityWarning: true,
    };
  }
  return {
    label: "Not Started",
    tone: "neutral",
    statusLine: "Not connected",
    eligibilityLine: "Blocked until complete",
    eligibilityWarning: true,
  };
}

export function pillStyle(tone: StatusPillTone): {
  background: string;
  color: string;
} {
  switch (tone) {
    case "success":
      return { background: "#d6ecd8", color: "#1c7a52" };
    case "warning":
      return { background: "#fdf7ee", color: "#8a6229" };
    case "danger":
      return { background: "#f8e6e6", color: "#a13d3d" };
    case "info":
      return { background: "#d3e5ef", color: "#183347" };
    default:
      return { background: "#f1f1ef", color: "rgba(55,53,47,.65)" };
  }
}

export function taxNeedsAction(data: TaxPaymentView) {
  const status = data.taxStatus;
  return (
    status === "not_started" ||
    status === "in_progress" ||
    status === "needs_attention" ||
    status === "expired"
  );
}

export function paymentNeedsAction(data: TaxPaymentView) {
  return (
    data.paymentSetupStatus !== "ready" ||
    data.payoutEligibility === "needs_payment_setup" ||
    data.payoutEligibility === "on_hold"
  );
}

export function showHoldBanner(data: TaxPaymentView) {
  return data.payoutEligibility !== "eligible";
}
