import { PARTNER_PATHS, SUPPORT_MAILTO } from "@/partner-center/lib/review-state";
import type { PayoutGate } from "@/partner-center/lib/payout-gate";
import type { StatusTone } from "@/partner-center/referrals/lib/format";

export type PayoutBannerCopy = {
  message: string;
  ctaLabel: string;
  href: string;
  tone: "warning" | "danger";
};

export type PayoutStatusCopy = {
  badge: string;
  badgeTone: StatusTone;
  title: string;
  description: string;
  footer: string;
};

export type FieldStatusCopy = {
  label: string;
  tone: StatusTone;
};

/** Maps gate → F36 / banner presentation. No eligibility logic. */
export function payoutBannerCopy(
  gate: Exclude<PayoutGate, "eligible">,
): PayoutBannerCopy {
  if (gate === "on_hold") {
    return {
      message: "Payouts on hold — contact Partnerships for details.",
      ctaLabel: "Contact support →",
      href: SUPPORT_MAILTO,
      tone: "danger",
    };
  }
  if (gate === "needs_payment_setup") {
    return {
      message:
        "Finish Stripe setup to unlock payouts. You can keep referring in the meantime.",
      ctaLabel: "Continue Stripe setup →",
      href: PARTNER_PATHS.settingsTaxStripe,
      tone: "warning",
    };
  }
  return {
    message:
      "Not yet payable — complete your tax profile to release payouts.",
    ctaLabel: "Complete tax profile →",
    href: PARTNER_PATHS.taxApp,
    tone: "warning",
  };
}

export function payableGateSubtitle(gate: PayoutGate): string | null {
  if (gate === "needs_tax_setup") {
    return "Not yet payable — tax profile incomplete";
  }
  if (gate === "needs_payment_setup") {
    return "Not yet payable — payment setup incomplete";
  }
  if (gate === "on_hold") {
    return "Payouts on hold — contact Partnerships";
  }
  return null;
}

export function payoutStatusCopy(gate: PayoutGate): PayoutStatusCopy {
  if (gate === "eligible") {
    return {
      badge: "Eligible",
      badgeTone: "success",
      title: "Ready for payout",
      description:
        "Tax profile and Stripe Connect are both complete. Payable earnings release on schedule.",
      footer: "Payable amounts release in the next scheduled run.",
    };
  }
  if (gate === "needs_tax_setup") {
    return {
      badge: "Needs tax setup",
      badgeTone: "warning",
      title: "Tax profile required",
      description:
        "A completed W-9 or W-8 is required before any earning can move to Payable.",
      footer:
        "Payable amounts release once your tax profile is complete.",
    };
  }
  if (gate === "needs_payment_setup") {
    return {
      badge: "Needs payment setup",
      badgeTone: "warning",
      title: "Stripe Connect required",
      description:
        "Tax profile is complete, but a connected Stripe payout account is still needed.",
      footer:
        "Payable amounts release in the next scheduled run once Stripe Connect is set up.",
    };
  }
  return {
    badge: "On hold",
    badgeTone: "danger",
    title: "Payouts on hold",
    description:
      "An admin has placed a hold on this account. Contact Partnerships for details.",
    footer: "Payouts are paused until Partnerships clears the hold.",
  };
}

export function taxProfileField(status: string): FieldStatusCopy {
  if (status === "complete") return { label: "Complete", tone: "success" };
  if (status === "in_progress") return { label: "In progress", tone: "warning" };
  if (status === "needs_attention") {
    return { label: "Needs attention", tone: "warning" };
  }
  if (status === "review_required") {
    return { label: "Review required", tone: "warning" };
  }
  if (status === "expired") return { label: "Expired", tone: "danger" };
  return { label: "Not started", tone: "warning" };
}

export function paymentSetupField(status: string | null): FieldStatusCopy {
  const value = (status ?? "").toLowerCase();
  if (value === "ready") return { label: "Complete", tone: "success" };
  if (value === "incomplete") return { label: "Incomplete", tone: "warning" };
  if (value === "on_hold") return { label: "On hold", tone: "danger" };
  return { label: "Not started", tone: "warning" };
}
