import { parseApplicationData } from "@/partner-center/lib/application-map";
import type { PartnerContext } from "@/partner-center/types/partner";

export const PARTNER_PATHS = {
  onboarding: "/partner-center/onboarding",
  pending: "/partner-center/onboarding/pending",
  moreInfo: "/partner-center/onboarding/more-info",
  declined: "/partner-center/onboarding/declined",
  approved: "/partner-center/onboarding/approved",
  agreement: "/partner-center/onboarding/agreement",
  agreementSigned: "/partner-center/onboarding/agreement/signed",
  checklist: "/partner-center/onboarding/checklist",
  company: "/partner-center/onboarding/company",
  contact: "/partner-center/onboarding/contact",
  agreementView: "/partner-center/onboarding/agreement/view",
  documents: "/partner-center/documents",
  programs: "/partner-center/onboarding/programs",
  guide: "/partner-center/onboarding/guide",
  tax: "/partner-center/onboarding/tax",
  payout: "/partner-center/onboarding/payout",
  payoutStripe: "/partner-center/onboarding/payout/stripe",
  payoutStripeReturn: "/partner-center/onboarding/payout/stripe/return",
  payoutStripeRefresh: "/partner-center/onboarding/payout/stripe/refresh",
  referral: "/partner-center/onboarding/referral",
  complete: "/partner-center/onboarding/complete",
  taxApp: "/partner-center/settings/tax",
  payoutApp: "/partner-center/settings/tax",
  payoutAppStripe: "/partner-center/settings/tax/stripe",
  app: "/partner-center",
  settings: "/partner-center/settings",
  settingsProfile: "/partner-center/settings/profile",
  settingsNotifications: "/partner-center/settings/notifications",
  settingsSecurity: "/partner-center/settings/security",
  settingsTax: "/partner-center/settings/tax",
  settingsTaxSetup: "/partner-center/settings/tax/setup",
  settingsTaxStripe: "/partner-center/settings/tax/stripe",
  settingsTaxStripeReturn: "/partner-center/settings/tax/stripe/return",
  settingsTaxStripeRefresh: "/partner-center/settings/tax/stripe/refresh",
} as const;

export const AGREEMENT_VERSION = "3.2";
export const AGREEMENT_EFFECTIVE = "August 1, 2026";
export const DEFAULT_DECLINE_REASON =
  "Application doesn't fit our current partner criteria. This isn't permanent — you're welcome to reapply once your business circumstances change.";
export const DEFAULT_INFO_REQUEST_MESSAGE =
  "Please provide the additional details we need to continue reviewing your application.";
export const SUPPORT_MAILTO =
  "mailto:righttailorg@gmail.com?subject=Partner%20Center%20application";

export function isAgreementSigned(status: string | null | undefined) {
  const value = (status ?? "").toLowerCase();
  return value === "signed" || value === "accepted";
}

export function isInfoRequestActive(raw: unknown) {
  return parseApplicationData(raw).info_request?.active === true;
}

export function partnerFlowPath(context: PartnerContext | null) {
  const profile = context?.profile ?? null;
  const status = profile?.status;
  const application = parseApplicationData(profile?.application_data);
  const signed = isAgreementSigned(profile?.agreement_status);

  // Company & Team invitees join an existing partner company — never the
  // applicant application / agreement / checklist path (primary contact only).
  const isInvitedTeammate =
    Boolean(context?.teamMember) &&
    Boolean(context?.contact?.id) &&
    context!.contact!.id !== profile?.primary_contact_id;

  if (status === "declined") return PARTNER_PATHS.declined;

  if (isInvitedTeammate) return PARTNER_PATHS.app;

  // Submitted applications stay in review until an admin approves — even when
  // submit created a partner_team_members row for the primary applicant.
  if ((status === "applied" || status === "under_review") && application.submitted) {
    return application.info_request?.active
      ? PARTNER_PATHS.moreInfo
      : PARTNER_PATHS.pending;
  }

  if (status === "active") return PARTNER_PATHS.app;

  if (status === "approved") {
    return signed ? PARTNER_PATHS.checklist : PARTNER_PATHS.approved;
  }

  return PARTNER_PATHS.onboarding;
}

export function formatProgramList(programs: string[]) {
  const labels = programs.map((item) => {
    if (item === "academy") return "Academy";
    if (item === "platform") return "Whitby";
    if (item === "enterprise") return "Enterprise";
    return item;
  });
  if (labels.length === 0) return "the Partner Program";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

export function formatSignedDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
