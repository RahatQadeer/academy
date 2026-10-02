export const PARTNER_ADMIN_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const PARTNER_ADMIN_PASSWORD_MIN = 12;
export const PARTNER_ADMIN_GENERIC_ERROR =
  "This invite link is not valid. Ask your Super Admin for a new one.";
export const PARTNER_ADMIN_SIGNIN_GENERIC_ERROR =
  "Sign-in is not available for this account.";

export type PartnerAdminStatus = "invited" | "active" | "revoked";

export type PartnerAdminRow = {
  id: string;
  email: string;
  user_id: string | null;
  status: PartnerAdminStatus;
  invite_token_hash: string | null;
  invite_expires_at: string | null;
  invited_by_email: string | null;
  invited_at: string;
  activated_at: string | null;
  revoked_at: string | null;
};

export type PartnerMessageChannel = "partner_manager" | "support_billing";

export function normalizeAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

/** Accept only paths under /partner-center/admin. */
export function sanitizePartnerAdminNext(raw: string | null | undefined): string {
  const fallback = "/partner-center/admin";
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("://") || value.includes("\\")) return fallback;
  if (value !== "/partner-center/admin" && !value.startsWith("/partner-center/admin/")) {
    return fallback;
  }
  return value;
}

export function passwordMeetsPartnerAdminRules(password: string) {
  return (
    password.length >= PARTNER_ADMIN_PASSWORD_MIN &&
    /[0-9]/.test(password) &&
    /[A-Z]/.test(password)
  );
}

export function partnerAdminPasswordProblem(password: string): string | null {
  if (!password) return "A password is needed.";
  if (password.length < PARTNER_ADMIN_PASSWORD_MIN) {
    return `Use at least ${PARTNER_ADMIN_PASSWORD_MIN} characters, a number, and an uppercase letter.`;
  }
  if (!/[0-9]/.test(password)) {
    return "That password still needs a number and an uppercase letter.";
  }
  if (!/[A-Z]/.test(password)) {
    return "That password still needs an uppercase letter.";
  }
  return null;
}
