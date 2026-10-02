import type { PartnerProfileStatus, PartnerTeamFunction } from "@/partner-center/types/partner";
import type { PreferredContactMethod } from "@/partner-center/team/lib/labels";

export type TeamTab = "profile" | "team";

export type PartnerAccessLevel = "admin" | "standard" | "read_only";

export type CompanyLocation = {
  id: string;
  label: string;
  street: string;
  postal_code: string;
  country: string;
};

export type TeamMemberRow = {
  id: string;
  contactId: string;
  name: string;
  email: string;
  roleTitle: string;
  salutation: string | null;
  phone: string | null;
  preferredContactMethod: PreferredContactMethod | "";
  function: PartnerTeamFunction | string;
  accessLevel: PartnerAccessLevel | string | null;
  initials: string;
  isPrimary: boolean;
};

export type PrimaryContactSummary = {
  contactId: string;
  name: string;
  email: string;
  phone: string | null;
  roleTitle: string;
  function: PartnerTeamFunction | string | null;
} | null;

export type TeamPageData = {
  companyId: string | null;
  companyName: string;
  website: string | null;
  businessType: string | null;
  marketsLabel: string;
  marketsRaw: string;
  audienceServed: string | null;
  partnerSince: string | null;
  status: PartnerProfileStatus | string | null;
  programs: string[];
  locations: CompanyLocation[];
  members: TeamMemberRow[];
  primaryContact: PrimaryContactSummary;
  canManage: boolean;
  profileId: string;
  /** Individual partners use Partner details (no Team tab). */
  isIndividual: boolean;
};

export function parseTeamTab(
  searchParams?: Record<string, string | string[] | undefined>,
): TeamTab {
  const raw = searchParams?.tab;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "team" ? "team" : "profile";
}
