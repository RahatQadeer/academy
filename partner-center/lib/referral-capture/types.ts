export type ValidatedReferralCode = {
  referralCodeId: string;
  partnerProfileId: string;
  code: string;
  cookieLifeDays: number;
};

export type CookieSpec = {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
};

import type { EngagedReferralProgram } from "@/partner-center/lib/referral-capture/infer-program";

export type ReferralAttribution = {
  code: string;
  capturedAt?: string;
  /**
   * Product-specific capture. Shared / omitted opens a platform row
   * (UI "Whitby") until Academy or Whitby entry; identity is also stored.
   */
  program?: EngagedReferralProgram;
  shared?: boolean;
};

export type SignupReferralInput = {
  userId: string;
  email: string;
  fullName?: string;
  referralCode: string;
  /** ISO timestamp from cookie; omit when code comes fresh from URL param. */
  capturedAt?: string;
  program?: EngagedReferralProgram;
  /**
   * Shared switcher signup: opens a platform (Whitby) row at signup.
   * Academy-scoped opens Academy; Whitby-scoped opens whitbyos.
   */
  shared?: boolean;
  /** When false, skip creating a referral (OAuth re-login). Defaults true. */
  isNewSignup?: boolean;
};

export type SignupReferralResult = {
  referralId?: string;
  created: boolean;
};
