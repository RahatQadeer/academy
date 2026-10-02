export {
  REFERRAL_COOKIE_NAME,
  DEFAULT_COOKIE_LIFE_DAYS,
  PARTNER_REF_CODE_META,
  PARTNER_REF_AT_META,
} from "@/partner-center/lib/referral-capture/constants";

export {
  inferReferralProgram,
  isNewSignupUser,
  commissionProgramForReferral,
  type ReferralProgram,
  type EngagedReferralProgram,
} from "@/partner-center/lib/referral-capture/infer-program";

export type {
  ValidatedReferralCode,
  CookieSpec,
  ReferralAttribution,
  SignupReferralInput,
  SignupReferralResult,
} from "@/partner-center/lib/referral-capture/types";

export {
  validateReferralCode,
  validateReferralCodeWithClient,
} from "@/partner-center/lib/referral-capture/validate-referral-code";

export { captureReferralFromParam } from "@/partner-center/lib/referral-capture/capture-referral";

export {
  encodeReferralCookieValue,
  parseReferralCookieValue,
  isReferralCookieExpired,
  resolveReferralAttributionFromCookie,
} from "@/partner-center/lib/referral-capture/parse-referral-cookie";

export { findOrCreateContactByEmail } from "@/partner-center/lib/referral-capture/find-or-create-contact";

export {
  createPartnerReferralOnSignup,
  createPartnerReferralOnSignupWithClient,
} from "@/partner-center/lib/referral-capture/create-referral-on-signup";

export {
  ensureProgramReferralForUser,
  ensureProgramReferralForUserSafe,
} from "@/partner-center/lib/referral-capture/ensure-program-referral";

export { ensureAcademyReferralOnEntry } from "@/partner-center/lib/referral-capture/ensure-academy-on-entry";

export { ensurePlatformReferralOnEntry } from "@/partner-center/lib/referral-capture/ensure-platform-on-entry";

export {
  persistReferralIdentity,
  readReferralIdentityFromUser,
} from "@/partner-center/lib/referral-capture/referral-identity";

export { applyReferralCaptureToResponse } from "@/partner-center/lib/referral-capture/middleware";
