import { siteUrl } from "@/base/auth/site";
import {
  inferReferralProgram,
  type EngagedReferralProgram,
} from "@/partner-center/lib/referral-capture/infer-program";

/** Prefer this deployment's host (preview-aware), not hard-coded production. */
function siteOrigin() {
  return siteUrl().replace(/\/$/, "");
}

function signupPath(params: URLSearchParams) {
  return `/signup?${params.toString()}`;
}

/** Shared link: signup then product switcher (Academy + Whitby). */
export function buildSharedReferralUrl(code: string) {
  const params = new URLSearchParams({
    ref: code,
    next: "/switcher",
  });
  return `${siteOrigin()}${signupPath(params)}`;
}

function buildSignupReferralUrl(code: string, program: EngagedReferralProgram) {
  const params = new URLSearchParams({ ref: code });
  if (program === "whitbyos") {
    params.set("brand", "whitbyos");
    params.set("next", "/whitbyos");
  } else {
    params.set("brand", "academy");
    params.set("next", "/academy/explore");
  }
  return `${siteOrigin()}${signupPath(params)}`;
}

/** Academy-only referral signup URL. */
export function buildAcademyReferralUrl(code: string) {
  return buildSignupReferralUrl(code, "academy");
}

/** Whitby referral signup URL. */
export function buildPlatformReferralUrl(code: string) {
  return buildSignupReferralUrl(code, "whitbyos");
}

/** Default partner copy link — shared switcher entry for Academy + Whitby. */
export function buildReferralUrl(code: string) {
  return buildSharedReferralUrl(code);
}

export function buildReferralUrlForProgram(
  code: string,
  program: EngagedReferralProgram,
) {
  return buildSignupReferralUrl(code, program);
}

/** True when the link is product-neutral (post-signup switcher). */
export function isSharedReferralDestination(
  next?: string | null,
  brand?: string | null,
): boolean {
  const brandKey = brand?.trim().toLowerCase() ?? "";
  if (
    brandKey === "academy" ||
    brandKey === "whitbyos" ||
    brandKey === "whitby" ||
    brandKey === "platform" ||
    brandKey === "partner" ||
    brandKey === "portal"
  ) {
    return false;
  }
  const path = (next?.trim() || "/switcher").split("?")[0] || "/switcher";
  return path === "/switcher" || path === "/";
}

export function inferProgramFromSignupUrl(url: string): EngagedReferralProgram | null {
  try {
    const parsed = new URL(url, siteOrigin() || "http://localhost");
    if (
      isSharedReferralDestination(
        parsed.searchParams.get("next"),
        parsed.searchParams.get("brand"),
      )
    ) {
      return null;
    }
    return inferReferralProgram({
      brand: parsed.searchParams.get("brand"),
      next: parsed.searchParams.get("next"),
    });
  } catch {
    return null;
  }
}
