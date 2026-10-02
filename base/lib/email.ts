export const EMAIL_ALREADY_REGISTERED = "EMAIL_ALREADY_REGISTERED";
export const ACCOUNT_UNAVAILABLE = "ACCOUNT_UNAVAILABLE";

export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  "An account already exists with this email. Please sign in to your existing account.";

export const ACCOUNT_UNAVAILABLE_MESSAGE = "This account is unavailable.";

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Keeps the deleted row (and its FKs) while freeing the original address. */
export function releasedEmailForDeletedAccount(userId: string, email: string): string {
  const normalized = normalizeEmail(email);
  const local = normalized.split("@")[0] || "account";
  const domain = normalized.split("@")[1] || "invalid.local";
  return `deleted.${userId}.${local}@${domain}`;
}

export function canLoginWithStatus(status: string | null | undefined): boolean {
  return status === "active";
}

export function isAuthDuplicateSignupError(message: string | null | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  if (!text) return false;
  return (
    text.includes("already registered") ||
    text.includes("already been registered") ||
    text.includes("user already exists") ||
    text.includes("email address is already") ||
    text.includes("already exists")
  );
}

export function mapSignupAuthError(message: string | null | undefined): {
  code: string;
  message: string;
} {
  if (isAuthDuplicateSignupError(message)) {
    return { code: EMAIL_ALREADY_REGISTERED, message: EMAIL_ALREADY_REGISTERED_MESSAGE };
  }
  return {
    code: "SIGNUP_FAILED",
    message: "Could not create account. Please try again.",
  };
}
