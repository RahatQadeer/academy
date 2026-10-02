/**
 * Production auth / product entry paths used by the Brent marketing landing.
 * Marketing module pages stay at `/modules/*`; these are the live app entry points.
 */
export const LANDING_AUTH = {
  signIn: "/login",
  getStarted: "/signup",
  whitby: "/whitbyos",
  whitbySignIn: "/login?next=/whitbyos",
  portal: "/client-portal",
  portalSignIn: "/login?brand=portal&next=/client-portal",
  academy: "/login?brand=academy&next=/academy",
  academyVerify: "/academy/verify",
  partner: "/partner-center",
  partnerApply: "/partner-center/apply",
  partnerSignIn: "/partner-center/signin",
  programTerms: "/partner-center/documents/terms",
  bookWalkthrough: "/signup",
  googleOAuth: "/auth/google?next=%2Fswitcher",
} as const;

export type LandingModuleKey = "whitby" | "portal" | "academy" | "partner";

/** Get-started destination for a module marketing page. */
export function moduleGetStartedHref(key: LandingModuleKey): string {
  switch (key) {
    case "portal":
      return "/signup?brand=portal&next=/client-portal";
    case "academy":
      return LANDING_AUTH.academy;
    case "partner":
      return LANDING_AUTH.partnerApply;
    case "whitby":
    default:
      return LANDING_AUTH.getStarted;
  }
}
