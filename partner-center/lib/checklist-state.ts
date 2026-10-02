import {
  addressFromUnknown,
  parseApplicationData,
} from "@/partner-center/lib/application-map";
import {
  AGREEMENT_VERSION,
  PARTNER_PATHS,
  formatSignedDate,
  isAgreementSigned,
} from "@/partner-center/lib/review-state";
import type { ApplicationData } from "@/partner-center/types/application";
import type { PartnerContext } from "@/partner-center/types/partner";

export type ChecklistItem = {
  id: string;
  label: string;
  note: string;
  done: boolean;
  href: string;
  action: "Edit" | "View" | "Review" | "Start" | "Get";
  /**
   * True when the step is listed but not yet available — grayed out, not
   * clickable. Referral stays locked until every other checklist item is done.
   */
  locked?: boolean;
};

export type BuildChecklistOptions = {
  /** True when a partner_links_codes referral_link row exists for this profile. */
  hasReferralLink?: boolean;
  /** True when at least one partner_programs row is active for this profile. */
  hasActivePrograms?: boolean;
};

function hostLabel(website: string) {
  return website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

export function buildChecklistItems(
  context: PartnerContext | null,
  options: BuildChecklistOptions = {},
) {
  const parsed = parseApplicationData(context?.profile?.application_data);

  const companyName = (context?.company?.name || parsed.legal_name).trim();
  const website = hostLabel(context?.company?.website || parsed.website);
  const contactName =
    context?.contact
      ? `${context.contact.first_name} ${context.contact.last_name}`.trim()
      : parsed.primary_contact_name;
  const email = context?.contact?.email || parsed.email;
  const signed = formatSignedDate(parsed.agreement_signed_at);
  const taxDone = context?.profile?.tax_profile_status === "complete";
  const payoutStatus = context?.profile?.payment_setup_status;
  const stripeLinked = Boolean(
    context?.profile?.stripe_connect_account_id?.trim(),
  );
  // Linked Connect account = partner finished the Stripe setup flow. Transfers
  // may still be pending ("incomplete") — eligibility is separate from this step.
  const payoutDone = payoutStatus === "ready" || stripeLinked;
  const hasReferralLink = options.hasReferralLink === true;
  const hasActivePrograms = options.hasActivePrograms === true;

  const priorItems: ChecklistItem[] = [
    {
      id: "company",
      label: "Company profile",
      note: [companyName, website].filter(Boolean).join(" · ") || "Legal name and website",
      done: Boolean(companyName),
      href: PARTNER_PATHS.company,
      action: "Edit",
    },
    {
      id: "contact",
      label: "Primary contact",
      note: [contactName, email].filter(Boolean).join(" · ") || "Name and email",
      done: Boolean(email),
      href: PARTNER_PATHS.contact,
      action: "Edit",
    },
    {
      id: "agreement",
      label: "Agreement & documents",
      note: signed
        ? `Signed ${signed} · v${AGREEMENT_VERSION}`
        : `Partner Agreement v${AGREEMENT_VERSION}`,
      done: isAgreementSigned(context?.profile?.agreement_status),
      href: PARTNER_PATHS.documents,
      action: "View",
    },
    {
      id: "programs",
      label: "Programs & terms",
      note: hasActivePrograms
        ? "Confirm your Academy and Whitby commission rates"
        : "Programs must be assigned before you can activate",
      done: Boolean(parsed.programs_confirmed_at) && hasActivePrograms,
      href: PARTNER_PATHS.programs,
      action: "Review",
    },
    {
      id: "guide",
      label: "Partner guide & policies",
      note: "5 minute read",
      done: Boolean(parsed.guide_acknowledged_at),
      href: PARTNER_PATHS.guide,
      action: "Start",
    },
    {
      id: "tax",
      label: "Tax profile",
      note: "Required before payouts can begin",
      done: taxDone,
      href: PARTNER_PATHS.tax,
      action: "Start",
    },
    {
      id: "payout",
      label: "Payout setup",
      note: payoutDone
        ? payoutStatus === "ready"
          ? "Stripe Connect is ready for payouts"
          : "Stripe Connect linked — waiting on Stripe if anything is still pending"
        : "Connect Stripe to receive commissions",
      done: payoutDone,
      href: PARTNER_PATHS.payout,
      action: payoutDone ? "View" : "Start",
    },
  ];

  const prerequisitesDone = priorItems.every((item) => item.done);
  const referralLocked = !hasReferralLink && !prerequisitesDone;

  const items: ChecklistItem[] = [
    ...priorItems,
    {
      id: "referral",
      label: "Referral link",
      note: hasReferralLink
        ? "Your referral link is ready to share"
        : referralLocked
          ? "Finish the steps above first"
          : "Create a link to start referring",
      done: hasReferralLink,
      href: PARTNER_PATHS.referral,
      action: hasReferralLink ? "View" : "Get",
      locked: referralLocked,
    },
  ];

  const firstOpen = items.find((item) => !item.done && !item.locked);
  return {
    items,
    doneCount: items.filter((item) => item.done).length,
    total: items.length,
    firstOpenId: firstOpen?.id ?? null,
    companyName: companyName || "your firm",
  };
}

/** True when every checklist step except referral is complete. */
export function isReferralChecklistUnlocked(
  context: PartnerContext | null,
  options: BuildChecklistOptions = {},
) {
  const { items } = buildChecklistItems(context, options);
  const referral = items.find((item) => item.id === "referral");
  return Boolean(referral && !referral.locked);
}

export function displayAddress(application: ApplicationData, addresses: unknown) {
  return application.address.trim() || addressFromUnknown(addresses);
}
