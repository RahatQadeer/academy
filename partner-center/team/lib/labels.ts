import type { PartnerTeamFunction } from "@/partner-center/types/partner";
import type { PartnerAccessLevel } from "@/partner-center/team/types";

export const TEAM_FUNCTIONS: { value: PartnerTeamFunction; label: string }[] = [
  { value: "company_admin", label: "Company Admin" },
  { value: "referral_contact", label: "Referral Contact" },
  { value: "billing_payment_contact", label: "Billing / Payment Contact" },
  { value: "authorized_signer", label: "Authorized Signer" },
  { value: "read_only", label: "Read Only" },
];

export const ACCESS_LEVELS: { value: PartnerAccessLevel; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "standard", label: "Standard" },
  { value: "read_only", label: "Read Only" },
];

export const BUSINESS_TYPE_OPTIONS = [
  "LLC",
  "Corporation",
  "Partnership",
  "Sole Proprietorship",
  "Registered Investment Advisor",
  "Other",
] as const;

export const PREFERRED_CONTACT_METHODS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "either", label: "Either" },
] as const;

export type PreferredContactMethod =
  (typeof PREFERRED_CONTACT_METHODS)[number]["value"];

export const SALUTATION_OPTIONS = [
  "",
  "Dr.",
  "Mr.",
  "Mrs.",
  "Ms.",
  "Sir",
  "Dame",
] as const;

export function preferredContactMethodLabel(
  value: string | null | undefined,
): string {
  const match = PREFERRED_CONTACT_METHODS.find((item) => item.value === value);
  return match?.label ?? (value ? humanize(value) : "—");
}

export function readPreferredContactMethod(
  enrichment: Record<string, unknown> | null | undefined,
): PreferredContactMethod | "" {
  const raw = enrichment?.preferred_contact_method;
  if (typeof raw !== "string") return "";
  const match = PREFERRED_CONTACT_METHODS.find((item) => item.value === raw);
  return match?.value ?? "";
}

const PROGRAM_LABELS: Record<string, string> = {
  academy: "Academy",
  platform: "Whitby",
  enterprise: "Enterprise",
};

export function functionLabel(value: string | null | undefined): string {
  const match = TEAM_FUNCTIONS.find((item) => item.value === value);
  return match?.label ?? (value ? humanize(value) : "—");
}

export function accessLabel(value: string | null | undefined): string {
  const match = ACCESS_LEVELS.find((item) => item.value === value);
  return match?.label ?? (value ? humanize(value) : "—");
}

export function statusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  if (value === "active") return "Active";
  if (value === "approved") return "Approved";
  if (value === "under_review") return "Under review";
  if (value === "applied") return "Applied";
  if (value === "declined") return "Declined";
  return humanize(value);
}

export function programLabel(value: string): string {
  return PROGRAM_LABELS[value] ?? humanize(value);
}

export function isAdminAccess(accessLevel: string | null | undefined): boolean {
  return accessLevel === "admin";
}

function humanize(value: string) {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
