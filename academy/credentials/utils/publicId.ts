import type { AcademyCredentialType } from "@/academy/lib/domain";

/** Visual prefixes with hyphens (PA-CC, PA-SE, PA-CPA). Lookup uses only the 7 digits. */
const TYPE_TO_PREFIX: Record<AcademyCredentialType, string> = {
  cpa_credential: "PA-CPA",
  specialty_endorsement: "PA-SE",
  certificate_of_completion: "PA-CC",
};

/** Longest first so PA-CPA wins over PA-C, and PA-SE over PA. */
const KNOWN_PREFIXES = [
  "PA-CPA",
  "PA-CC",
  "PA-SE",
  "PACPA",
  "PASE",
  "PACC",
  "PACP",
] as const;

export function certificatePrefixForType(type: string): string {
  if (type === "cpa_credential") return TYPE_TO_PREFIX.cpa_credential;
  if (type === "specialty_endorsement") return TYPE_TO_PREFIX.specialty_endorsement;
  return TYPE_TO_PREFIX.certificate_of_completion;
}

export function isCertificateNumber(value: string): boolean {
  return /^[0-9]{7}$/.test(value);
}

/**
 * Canonical certificate id: exactly seven digits.
 * Accepts `1234567`, `PA-SE-1234567`, `PASE-1234567`, spaced variants, etc.
 */
export function extractCertificateNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const compact = trimmed.toUpperCase().replace(/[\s_]/g, "");
  let rest = compact;
  for (const prefix of KNOWN_PREFIXES) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length).replace(/^-+/, "");
      break;
    }
  }

  const digits = rest.replace(/\D/g, "");
  if (isCertificateNumber(digits)) return digits;

  const allDigits = compact.replace(/\D/g, "");
  if (isCertificateNumber(allDigits)) return allDigits;

  return null;
}

/** Visual print form, e.g. `PA-SE-1234567`. */
export function formatCredentialPublicId(type: string, certificateNumber: string): string {
  const number = extractCertificateNumber(certificateNumber) ?? certificateNumber.trim();
  if (!isCertificateNumber(number)) return number;
  return `${certificatePrefixForType(type)}-${number}`;
}

/** Normalize user input for verify URLs — prefer the 7-digit canonical id. */
export function normalizeCredentialPublicId(raw: string): string {
  const number = extractCertificateNumber(raw);
  if (number) return number;
  return raw.trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
}

export function parseCredentialPublicId(raw: string): {
  number: string;
  publicId: string;
  displayHint: string | null;
} | null {
  const number = extractCertificateNumber(raw);
  if (!number) return null;

  const compact = raw.trim().toUpperCase().replace(/[\s_]/g, "");
  let displayHint: string | null = null;
  for (const prefix of KNOWN_PREFIXES) {
    if (compact.startsWith(prefix)) {
      displayHint = prefix;
      break;
    }
  }

  return { number, publicId: number, displayHint };
}

/** Public verification URL for a certificate (digits or prefixed display form). */
export function credentialVerifyPath(publicIdOrNumber: string): string {
  return `/academy/verify/${encodeURIComponent(normalizeCredentialPublicId(publicIdOrNumber))}`;
}
