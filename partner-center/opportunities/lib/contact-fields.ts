/** Shared contact email / phone helpers for opportunity forms. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Digits only; international local numbers are typically 7–15 digits. */
export const PHONE_DIGITS_RE = /^\d{7,15}$/;

export type DialCodeOption = {
  code: string;
  label: string;
};

export const COUNTRY_DIAL_CODES: DialCodeOption[] = [
  { code: "+1", label: "US/CA +1" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+64", label: "NZ +64" },
  { code: "+91", label: "IN +91" },
  { code: "+92", label: "PK +92" },
  { code: "+971", label: "AE +971" },
  { code: "+966", label: "SA +966" },
  { code: "+65", label: "SG +65" },
  { code: "+81", label: "JP +81" },
  { code: "+49", label: "DE +49" },
  { code: "+33", label: "FR +33" },
  { code: "+39", label: "IT +39" },
  { code: "+34", label: "ES +34" },
  { code: "+31", label: "NL +31" },
  { code: "+46", label: "SE +46" },
  { code: "+41", label: "CH +41" },
  { code: "+353", label: "IE +353" },
  { code: "+27", label: "ZA +27" },
  { code: "+55", label: "BR +55" },
  { code: "+52", label: "MX +52" },
  { code: "+86", label: "CN +86" },
  { code: "+82", label: "KR +82" },
  { code: "+63", label: "PH +63" },
  { code: "+60", label: "MY +60" },
  { code: "+62", label: "ID +62" },
];

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPhoneLocal(value: string): boolean {
  return PHONE_DIGITS_RE.test(digitsOnly(value));
}

/** Combine dial code + local number into a single stored phone string. */
export function formatPhoneWithCountry(
  dialCode: string,
  local: string,
): string {
  const localDigits = digitsOnly(local);
  if (!localDigits) return "";
  const code = dialCode.trim() || "+1";
  return `${code} ${localDigits}`;
}

/**
 * Split a stored phone into dial code + local digits for edit forms.
 * Prefers the longest matching known dial code.
 */
export function parsePhoneWithCountry(stored: string | null | undefined): {
  dialCode: string;
  local: string;
} {
  const raw = (stored ?? "").trim();
  if (!raw) return { dialCode: "+1", local: "" };

  const normalized = raw.startsWith("+") ? raw : `+${digitsOnly(raw)}`;
  const sorted = [...COUNTRY_DIAL_CODES].sort(
    (a, b) => b.code.length - a.code.length,
  );
  for (const option of sorted) {
    if (
      normalized === option.code ||
      normalized.startsWith(`${option.code} `) ||
      normalized.startsWith(option.code)
    ) {
      const rest = normalized.slice(option.code.length);
      return { dialCode: option.code, local: digitsOnly(rest) };
    }
  }

  return { dialCode: "+1", local: digitsOnly(raw) };
}
