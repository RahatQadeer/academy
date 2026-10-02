export const PARTNER_AUTH_PATHS = [
  "/partner-center/signin",
  "/partner-center/apply",
  "/partner-center/forgot-password",
  "/partner-center/reset-password",
  "/partner-center/check-email",
  "/partner-center/confirmed",
] as const;

export const PARTNER_ADMIN_AUTH_PATHS = [
  "/partner-center/admin/signin",
  "/partner-center/admin/signup",
  "/partner-center/admin/forgot-password",
  "/partner-center/admin/reset-password",
] as const;

/** Build `/partner-center/...` from the optional catch-all slug segments. */
export function partnerPathFromSlug(slug?: string[]) {
  const rest = (slug ?? []).filter(Boolean).join("/");
  return rest ? `/partner-center/${rest}` : "/partner-center";
}

export function isPartnerInvitePath(pathname: string) {
  return pathname.startsWith("/partner-center/invite/");
}

export function isPartnerAdminAuthPath(pathname: string) {
  return (PARTNER_ADMIN_AUTH_PATHS as readonly string[]).includes(pathname);
}

export function isPartnerAdminPath(pathname: string) {
  return (
    pathname === "/partner-center/admin" ||
    pathname.startsWith("/partner-center/admin/")
  );
}

/**
 * Reachable while signed out. Includes team invite links so middleware does not
 * bounce email clicks to /partner-center/signin before the accept form can run.
 */
export function isPartnerAuthPath(pathname: string) {
  return (
    PARTNER_AUTH_PATHS.some((path) => pathname === path) ||
    isPartnerInvitePath(pathname) ||
    isPartnerAdminAuthPath(pathname)
  );
}

export function isPartnerFullScreenPath(pathname: string) {
  return (
    isPartnerAuthPath(pathname) ||
    isPartnerAdminPath(pathname) ||
    pathname === "/partner-center/onboarding" ||
    pathname.startsWith("/partner-center/onboarding/")
  );
}
