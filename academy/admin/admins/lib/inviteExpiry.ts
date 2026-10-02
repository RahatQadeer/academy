/** Academy Admin invite links are valid for 24 hours (same as Instructor). */
export const ADMIN_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export function adminInviteExpiresAt(from = new Date()) {
  return new Date(from.getTime() + ADMIN_INVITE_TTL_MS).toISOString();
}

export function adminInviteIsExpired(expiresAt: string | null) {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() <= Date.now();
}

export function adminInviteExpiryLabel(expiresAt: string | null) {
  if (!expiresAt) return "No expiry set";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "No expiry set";
  if (date.getTime() <= Date.now()) return "Expired";

  const ms = date.getTime() - Date.now();
  const hours = Math.max(1, Math.round(ms / (60 * 60 * 1000)));
  if (hours >= 24) return "Expires in 1 day";
  if (hours === 1) return "Expires in 1 hour";
  return `Expires in ${hours} hours`;
}
