import type { AcademyCredentialType } from "@/academy/lib/domain";
import { credentialTypeLabel } from "@/academy/credentials/utils/labels";

export function credentialKindLabel(type: AcademyCredentialType) {
  return credentialTypeLabel(type);
}

export function credentialKindShort(type: AcademyCredentialType) {
  if (type === "cpa_credential") return "Main credential";
  if (type === "specialty_endorsement") return "Endorsement";
  return "Completion";
}

export function formatCredentialDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function expiryFromAward(awardedAt: Date, years = 3) {
  const expires = new Date(awardedAt);
  expires.setFullYear(expires.getFullYear() + years);
  return expires.toISOString();
}

/** @deprecated Prefer expiryFromAward — kept for call sites that still say CPA. */
export function cpaExpiryFrom(awardedAt: Date) {
  return expiryFromAward(awardedAt, 3);
}

export function termLabel(
  expiresAt: string | null,
  options?: { programValidity?: string | null; awarded?: boolean },
) {
  if (expiresAt) {
    return `Expires ${formatCredentialDate(expiresAt)}`;
  }
  if (options?.programValidity === "three_years" && !options.awarded) {
    return "3 years from award";
  }
  return "Does not expire";
}

export function certificateDesignNote(type: AcademyCredentialType) {
  if (type === "cpa_credential") {
    return "Issues the Certified Private Attaché certificate. Expiry follows the program’s Certificate validity setting.";
  }
  if (type === "specialty_endorsement") {
    return "Issues a Specialty Endorsement certificate. Expiry follows the program’s Certificate validity setting.";
  }
  return "Issues a Certificate of Completion. Expiry follows the program’s Certificate validity setting.";
}
