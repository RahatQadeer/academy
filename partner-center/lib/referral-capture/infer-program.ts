import { isAcademyNext } from "@/base/auth/query";

/**
 * Stored on partner_referrals.program:
 * - platform = unsigned signup (UI "Whitby")
 * - whitbyos = Whitby engagement (UI "Whitby")
 * - academy = Academy
 */
export type ReferralProgram = "academy" | "platform" | "whitbyos";

/** Product-scoped engagement — not the unsigned platform placeholder. */
export type EngagedReferralProgram = "academy" | "whitbyos";

/** Infer engaged program from signup/auth query params. */
export function inferReferralProgram(options?: {
  brand?: string | null;
  next?: string | null;
}): EngagedReferralProgram {
  const brand = options?.brand?.trim().toLowerCase() ?? "";
  const next = options?.next?.trim() ?? "";

  if (
    brand === "whitbyos" ||
    brand === "whitby" ||
    brand === "platform" ||
    next.startsWith("/whitbyos")
  ) {
    return "whitbyos";
  }

  if (brand === "academy" || isAcademyNext(next)) {
    return "academy";
  }

  // Callers that need a product-neutral result should use
  // isSharedReferralDestination first — this path is engaged-only.
  return "academy";
}

/** Map referral/attribution product onto partner commission program family. */
export function commissionProgramForReferral(
  program: string,
): "academy" | "platform" | "enterprise" | null {
  if (program === "academy") return "academy";
  if (program === "whitbyos" || program === "platform") return "platform";
  if (program === "enterprise") return "enterprise";
  return null;
}

/** SRS 17.5.10 — only attribute users created in the current auth session. */
export function isNewSignupUser(createdAt: string | undefined | null): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return false;
  return Date.now() - createdMs < 10 * 60 * 1000;
}
