import type { Company, Contact, Entitlement } from "@/base/types";
import type { ApplicationData } from "./application";

export type PartnerProfileStatus =
  | "applied"
  | "under_review"
  | "approved"
  | "active"
  | "declined";

export type PartnerPayoutEligibility =
  | "eligible"
  | "needs_tax_setup"
  | "needs_payment_setup"
  | "on_hold";

export type PartnerTaxStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "needs_attention"
  | "review_required"
  | "expired";

export type PartnerTeamFunction =
  | "company_admin"
  | "referral_contact"
  | "billing_payment_contact"
  | "authorized_signer"
  | "read_only";

export type PartnerProfile = {
  id: string;
  company_id: string;
  primary_contact_id: string;
  status: PartnerProfileStatus;
  partner_type: string | null;
  application_data: ApplicationData | Record<string, unknown> | null;
  agreement_status: string | null;
  agreement_document_id: string | null;
  tax_profile_status: PartnerTaxStatus;
  payment_setup_status: string | null;
  payout_eligibility: PartnerPayoutEligibility;
  /** Stripe Express connected account id (`acct_…`); never bank/TIN data. */
  stripe_connect_account_id: string | null;
  /** Partner-selected payout rail (§17.13.6). */
  preferred_payout_method?:
    | "stripe_connect"
    | "quickbooks"
    | "ach"
    | "check"
    | null;
  created_at: string;
  updated_at: string;
};

export type PartnerTeamMember = {
  id: string;
  partner_profile_id: string;
  contact_id: string;
  function: PartnerTeamFunction | string;
  access_level: string | null;
  created_at: string;
};

export type PartnerContext = {
  entitlement: Entitlement;
  contact: Contact | null;
  teamMember: PartnerTeamMember | null;
  profile: PartnerProfile | null;
  company: Company | null;
};
