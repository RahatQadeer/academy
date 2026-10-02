import type { ApplicationData } from "@/partner-center/types/application";
import type { PartnerProfileStatus } from "@/partner-center/types/partner";

export type ApplicationTab = "pending" | "all" | "approved" | "declined";

export type OpportunityTab =
  | "all"
  | "submitted"
  | "accepted"
  | "in_progress"
  | "converted"
  | "closed";

export type ReferralTab =
  | "all"
  | "referred"
  | "in_progress"
  | "converted"
  | "not_converted";

export type ApplicationListItem = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: PartnerProfileStatus | string;
  submittedAt: string;
  productsLabel: string;
  infoRequestActive: boolean;
};

export type ApplicationDetail = {
  id: string;
  status: PartnerProfileStatus | string;
  application: ApplicationData;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  createdAt: string;
  updatedAt: string;
};

export type PartnerListItem = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: PartnerProfileStatus | string;
  programsLabel: string;
  payoutEligibility: string;
  activatedAt: string | null;
};

export type PartnerDetail = {
  id: string;
  status: PartnerProfileStatus | string;
  companyName: string;
  website: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  programs: { program: string; active: boolean }[];
  taxProfileStatus: string;
  paymentSetupStatus: string | null;
  payoutEligibility: string;
  agreementStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOpportunityListItem = {
  id: string;
  partnerProfileId: string;
  partnerCompanyName: string;
  companyName: string;
  contactName: string | null;
  productInterest: string | null;
  status: string;
  submittedAt: string;
  protectedUntil: string | null;
};

export type AdminOpportunityDetail = {
  id: string;
  partnerProfileId: string;
  partnerCompanyName: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactTitle: string | null;
  productInterest: string | null;
  productInterestLabel: string | null;
  estimatedSeats: number | null;
  estimatedValue: number | null;
  expectedTiming: string | null;
  additionalContext: string | null;
  status: string;
  submittedAt: string;
  acceptedAt: string | null;
  protectedUntil: string | null;
  permissionToContact: boolean;
  attachmentTitle: string | null;
  attributionItems: AdminOpportunityAttributionItem[];
  hasPaidEarnings: boolean;
};

export type AdminOpportunityAttributionItem = {
  eventId: string;
  externalPaymentId: string | null;
  amountCollectedUsd: number | null;
  eventTimestamp: string;
  earningId: string | null;
  earningAmount: number | null;
  earningStatus: string | null;
};

export type AdminReferralListItem = {
  id: string;
  partnerProfileId: string;
  partnerCompanyName: string;
  program: string;
  status: string;
  source: string | null;
  referralDate: string;
  referredEmail: string | null;
  referredName: string | null;
};

export type AdminReferralDetail = {
  id: string;
  partnerProfileId: string;
  partnerCompanyName: string;
  program: string;
  status: string;
  source: string | null;
  product: string | null;
  referralDate: string;
  conversionEventDate: string | null;
  referredUserId: string | null;
  referredEmail: string | null;
  referredName: string | null;
  hasPaidEarnings: boolean;
};

export type AdminPartnerOption = {
  id: string;
  companyName: string;
};

export type DashboardStats = {
  pendingApplications: number;
  submittedOpportunities: number;
  activePartners: number;
  failedPayouts: number;
  configured: boolean;
};

export type PayablePartnerListItem = {
  id: string;
  companyName: string;
  payableTotal: number;
  payableCount: number;
  payoutEligibility: string;
  taxProfileStatus: string;
  paymentSetupStatus: string | null;
  preferredPayoutMethod: string | null;
  stripeConnected: boolean;
};

export type PartnerPayoutHistoryItem = {
  id: string;
  partnerProfileId: string;
  companyName: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
};
