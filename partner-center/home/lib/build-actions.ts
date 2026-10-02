import type { ActionNeededItem } from "@/partner-center/home/types";
import type { ChecklistItem } from "@/partner-center/lib/checklist-state";
import { resolvePayoutGate } from "@/partner-center/lib/payout-gate";
import {
  PARTNER_PATHS,
  isInfoRequestActive,
} from "@/partner-center/lib/review-state";
import { formatMoney } from "@/partner-center/referrals/lib/format";
import type {
  PartnerPayoutEligibility,
  PartnerTaxStatus,
} from "@/partner-center/types/partner";

/** Checklist ids owned by the payout block — never also emit from checklist feed. */
const PAYOUT_CHECKLIST_IDS = new Set(["tax", "payout"]);

type DocumentRow = {
  id: string;
  title: string;
  effective_date: string | null;
};

type ProfilePayoutFields = {
  tax_profile_status: PartnerTaxStatus | string;
  payment_setup_status: string | null;
  payout_eligibility: PartnerPayoutEligibility | string;
  status: string;
};

function formatDue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function appendPayoutActions(
  items: ActionNeededItem[],
  profile: ProfilePayoutFields,
  payableTotal: number,
) {
  const taxHref = PARTNER_PATHS.settingsTax;
  const payoutHref = PARTNER_PATHS.settingsTaxStripe;
  const gate = resolvePayoutGate(profile);

  if (gate === "on_hold") {
    items.push({
      id: "payout-hold",
      category: "payout",
      title: "Payout on hold",
      detail: "Contact support to resolve the hold before commissions can be paid.",
      href: PARTNER_PATHS.settingsTax,
      cta: "Review",
    });
    return;
  }

  if (gate === "needs_tax_setup") {
    const detail =
      payableTotal > 0
        ? `Blocking ${formatMoney(payableTotal)} in payable earnings`
        : "Required before commissions can be paid out";
    items.push({
      id: "tax-profile",
      category: "payout",
      title: "Tax profile required before payout",
      detail,
      href: taxHref,
      cta: "Complete",
    });
    return;
  }

  if (gate === "needs_payment_setup") {
    items.push({
      id: "payment-setup",
      category: "payout",
      title: "Finish Stripe setup",
      detail:
        "You already started Connect — open Stripe to finish any remaining details",
      href: payoutHref,
      cta: "Continue",
    });
  }
}

/**
 * Action Needed only lists partner-actionable items (setup, payout gates,
 * documents, unread messages). Opportunity status changes are informational —
 * they go to the notification bell via `notifyPartnerOpportunityStatus`.
 */
export function buildActionItems(input: {
  profile: ProfilePayoutFields;
  payableTotal: number;
  checklistItems: ChecklistItem[];
  applicationData: unknown;
  documents: DocumentRow[];
  unreadMessages?: number;
}): ActionNeededItem[] {
  const items: ActionNeededItem[] = [];

  // 1. Incomplete checklist items except tax / payout (owned by payout block).
  // Locked steps (referral until prerequisites are done) stay off this list.
  for (const item of input.checklistItems) {
    if (item.done || item.locked) continue;
    if (PAYOUT_CHECKLIST_IDS.has(item.id)) continue;
    items.push({
      id: `setup-${item.id}`,
      category: "setup",
      title: item.label,
      detail: item.note,
      href: item.href,
      cta: item.action,
    });
  }

  // 2. Active info request (missing application info).
  if (isInfoRequestActive(input.applicationData)) {
    items.push({
      id: "info-request",
      category: "setup",
      title: "More information needed",
      detail: "Respond to the request so your application can move forward",
      href: PARTNER_PATHS.moreInfo,
      cta: "Respond",
    });
  }

  // 3. Payout block (tax gates payment; on_hold wins).
  appendPayoutActions(items, input.profile, input.payableTotal);

  // 4. Documents with action_needed — separate from agreement checklist (decision #2).
  for (const doc of input.documents) {
    const due = formatDue(doc.effective_date);
    items.push({
      id: `doc-${doc.id}`,
      category: "document",
      title: doc.title || "Document action required",
      detail: due ? `Due ${due}` : undefined,
      href: `/partner-center/documents/${doc.id}`,
      cta: "Review",
    });
  }

  // 5. Unread program support messages.
  if ((input.unreadMessages ?? 0) > 0) {
    const count = input.unreadMessages ?? 0;
    items.push({
      id: "unread-messages",
      category: "message",
      title: count === 1 ? "1 unread message" : `${count} unread messages`,
      detail: "Private Attaché sent an update about your account or referrals",
      href: "/partner-center/messages",
      cta: "View",
    });
  }

  return items;
}
