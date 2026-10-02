/** HttpOnly cookie storing captured referral code + timestamp. */
export const REFERRAL_COOKIE_NAME = "pa_partner_ref";

/** Fallback when partner_links_codes.cookie_life_days is null. */
export const DEFAULT_COOKIE_LIFE_DAYS = 90;

export const SECONDS_PER_DAY = 86_400;

/** Hardcoded demo scope — one program for initial attribution. */
export const REFERRAL_PROGRAM = "academy" as const;

export const REFERRAL_SOURCE = "link" as const;

export const REFERRAL_STATUS = "referred" as const;

export const CONTACT_SOURCE = "partner_referral";

/** Auth user_metadata keys — identity attribution after shared signup (no program row yet). */
export const PARTNER_REF_CODE_META = "pa_partner_ref_code";
export const PARTNER_REF_AT_META = "pa_partner_ref_at";
