import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REFERRAL_COOKIE_NAME,
  SECONDS_PER_DAY,
} from "@/partner-center/lib/referral-capture/constants";
import {
  encodeReferralCookieValue,
  parseReferralCookieValue,
  isReferralCookieExpired,
} from "@/partner-center/lib/referral-capture/parse-referral-cookie";
import type { EngagedReferralProgram } from "@/partner-center/lib/referral-capture/infer-program";
import type { CookieSpec } from "@/partner-center/lib/referral-capture/types";
import { validateReferralCode } from "@/partner-center/lib/referral-capture/validate-referral-code";
import { loadPlatformAttributionConfig } from "@/super-admin/partner-center/services/platform-attribution-config";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";

/**
 * Capture referral code into cookie. Under first-touch mode, never overwrite
 * an unexpired existing cookie (SRS §17.9.4 / §17.14.5).
 */
export async function captureReferralFromParam(
  code: string,
  supabase?: SupabaseClient,
  scope: EngagedReferralProgram | "shared" = "shared",
  existingCookieRaw?: string | null,
): Promise<CookieSpec | null> {
  const validated = await validateReferralCode(code, supabase);
  if (!validated) return null;

  const admin = supabase ?? createAdminClient();
  let mode: "first_touch" | "last_touch" = "first_touch";
  if (admin) {
    try {
      const config = await loadPlatformAttributionConfig(admin);
      mode = config.attributionMode;
    } catch {
      // default first_touch
    }
  }

  if (mode === "first_touch" && existingCookieRaw) {
    const existing = parseReferralCookieValue(existingCookieRaw);
    if (
      existing?.capturedAt &&
      !isReferralCookieExpired(existing.capturedAt, validated.cookieLifeDays)
    ) {
      // Keep first partner — do not replace cookie.
      return null;
    }
  }

  const capturedAtIso = new Date().toISOString();
  const cookieScope = scope === "whitbyos" ? "whitbyos" : scope;

  return {
    name: REFERRAL_COOKIE_NAME,
    value: encodeReferralCookieValue(
      validated.code,
      capturedAtIso,
      cookieScope,
    ),
    maxAge: validated.cookieLifeDays * SECONDS_PER_DAY,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  };
}
