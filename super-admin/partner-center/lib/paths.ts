export const PROGRAM_CONFIG_SECTIONS = [
  "commission",
  "attribution",
  "enterprise",
  "product-interests",
  "tax",
  "quickbooks",
  "firstpromoter",
] as const;

export type ProgramConfigSection = (typeof PROGRAM_CONFIG_SECTIONS)[number];

export const OPPORTUNITY_DETAIL_SECTIONS = [
  "details",
  "payments",
  "record-payment",
  "extend-protection",
  "correct-attribution",
] as const;

export type OpportunityDetailSection =
  (typeof OPPORTUNITY_DETAIL_SECTIONS)[number];

export const PARTNER_DOCUMENT_SECTIONS = [
  "metadata",
  "signature",
  "amendment",
] as const;

export type PartnerDocumentSection =
  (typeof PARTNER_DOCUMENT_SECTIONS)[number];

export const PARTNER_DETAIL_SECTIONS = [
  "details",
  "documents",
  "application",
  "terms",
] as const;

export type PartnerDetailSection = (typeof PARTNER_DETAIL_SECTIONS)[number];

/** Old section query values that now map to Details. */
const LEGACY_DETAIL_SECTIONS = new Set([
  "prospect",
  "opportunity",
  "attribution",
]);

export const PC_ADMIN = {
  root: "/super-admin/partner-center",
  applications: "/super-admin/partner-center/applications",
  application: (id: string) => `/super-admin/partner-center/applications/${id}`,
  partners: "/super-admin/partner-center/partners",
  partner: (id: string) => `/super-admin/partner-center/partners/${id}`,
  partnerSection: (id: string, section: PartnerDetailSection) =>
    `/super-admin/partner-center/partners/${id}?section=${section}`,
  partnerTerms: (id: string) =>
    `/super-admin/partner-center/partners/${id}?section=terms`,
  partnerDocuments: (id: string) =>
    `/super-admin/partner-center/partners/${id}/documents`,
  partnerDocument: (
    id: string,
    documentId: string,
    section: PartnerDocumentSection = "metadata",
  ) =>
    `/super-admin/partner-center/partners/${id}/documents/${documentId}?section=${section}`,
  referrals: "/super-admin/partner-center/referrals",
  referralNew: "/super-admin/partner-center/referrals/new",
  referral: (id: string) => `/super-admin/partner-center/referrals/${id}`,
  opportunities: "/super-admin/partner-center/opportunities",
  opportunity: (id: string) => `/super-admin/partner-center/opportunities/${id}`,
  opportunitySection: (id: string, section: OpportunityDetailSection) =>
    `/super-admin/partner-center/opportunities/${id}?section=${section}`,
  opportunityAttachment: (id: string) =>
    `/super-admin/partner-center/opportunities/${id}/attachment`,
  payouts: "/super-admin/partner-center/payouts",
  messages: "/super-admin/partner-center/messages",
  message: (profileId: string) =>
    `/super-admin/partner-center/messages/${profileId}`,
  programConfig: "/super-admin/partner-center/program-config",
  programConfigSection: (section: ProgramConfigSection) =>
    `/super-admin/partner-center/program-config?section=${section}`,
  tax1099: "/super-admin/partner-center/tax-1099",
} as const;

export function parseProgramConfigSection(
  value: string | string[] | undefined,
): ProgramConfigSection {
  const raw = typeof value === "string" ? value : undefined;
  if (
    raw &&
    (PROGRAM_CONFIG_SECTIONS as readonly string[]).includes(raw)
  ) {
    return raw as ProgramConfigSection;
  }
  return "commission";
}

export function parseOpportunityDetailSection(
  value: string | string[] | undefined,
): OpportunityDetailSection {
  const raw = typeof value === "string" ? value : undefined;
  if (!raw) return "details";
  if (LEGACY_DETAIL_SECTIONS.has(raw)) return "details";
  if ((OPPORTUNITY_DETAIL_SECTIONS as readonly string[]).includes(raw)) {
    return raw as OpportunityDetailSection;
  }
  return "details";
}

export function parsePartnerDocumentSection(
  value: string | string[] | undefined,
): PartnerDocumentSection {
  const raw = typeof value === "string" ? value : undefined;
  if (
    raw &&
    (PARTNER_DOCUMENT_SECTIONS as readonly string[]).includes(raw)
  ) {
    return raw as PartnerDocumentSection;
  }
  return "metadata";
}

export function parsePartnerDetailSection(
  value: string | string[] | undefined,
): PartnerDetailSection {
  const raw = typeof value === "string" ? value : undefined;
  if (
    raw &&
    (PARTNER_DETAIL_SECTIONS as readonly string[]).includes(raw)
  ) {
    return raw as PartnerDetailSection;
  }
  return "details";
}
