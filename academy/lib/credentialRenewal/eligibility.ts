/**
 * Learner (and admin one-click) renewal opens on the certificate's expiration
 * calendar day and stays open afterward. Before that day, Renew must stay disabled.
 */
export function isCredentialRenewalOpen(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return false;

  // Compare calendar days in local time so "the day comes" matches what the
  // learner sees on the certificate label.
  const expiryDay = new Date(
    expires.getFullYear(),
    expires.getMonth(),
    expires.getDate(),
  ).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return today >= expiryDay;
}

/** True while the term is still active (before the expiry calendar day). */
export function isCredentialRenewalLocked(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  return Boolean(expiresAt) && !isCredentialRenewalOpen(expiresAt, now);
}
