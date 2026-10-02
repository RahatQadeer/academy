import {
  DEFAULT_COOKIE_LIFE_DAYS,
  REFERRAL_COOKIE_NAME,
  SECONDS_PER_DAY,
} from "@/partner-center/lib/referral-capture/constants";
import type { EngagedReferralProgram } from "@/partner-center/lib/referral-capture/infer-program";
import type { ReferralAttribution } from "@/partner-center/lib/referral-capture/types";

const COOKIE_VALUE_SEPARATOR = ":";
/** Cookie scopes. Legacy `platform` meant Whitby-scoped; map to whitbyos. */
const SCOPE_SUFFIXES = ["shared", "whitbyos", "platform", "academy"] as const;
type ReferralCaptureScope = (typeof SCOPE_SUFFIXES)[number];

export function encodeReferralCookieValue(
  code: string,
  capturedAtIso: string,
  scope: ReferralCaptureScope = "shared",
): string {
  return `${code}${COOKIE_VALUE_SEPARATOR}${capturedAtIso}${COOKIE_VALUE_SEPARATOR}${scope}`;
}

function stripScopeSuffix(rest: string): {
  capturedAt: string;
  scope: ReferralCaptureScope;
} {
  for (const scope of SCOPE_SUFFIXES) {
    const suffix = `${COOKIE_VALUE_SEPARATOR}${scope}`;
    if (rest.endsWith(suffix)) {
      return {
        capturedAt: rest.slice(0, -suffix.length).trim(),
        scope,
      };
    }
  }
  // Legacy cookies without a scope suffix — treat as shared (unsigned platform row).
  return { capturedAt: rest.trim(), scope: "shared" };
}

export function parseReferralCookieValue(
  raw: string | undefined | null,
): ReferralAttribution | null {
  if (!raw?.trim()) return null;

  const separatorIndex = raw.indexOf(COOKIE_VALUE_SEPARATOR);
  if (separatorIndex <= 0) return null;

  const code = raw.slice(0, separatorIndex).trim();
  if (!code) return null;

  const { capturedAt, scope } = stripScopeSuffix(raw.slice(separatorIndex + 1));
  if (!capturedAt) return null;

  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(capturedMs)) return null;

  if (scope === "shared") {
    return { code, capturedAt, shared: true };
  }

  // Legacy cookie scope `platform` was Whitby-scoped.
  const program: EngagedReferralProgram =
    scope === "platform" || scope === "whitbyos" ? "whitbyos" : "academy";

  return { code, capturedAt, program };
}

export function isReferralCookieExpired(
  capturedAt: string,
  cookieLifeDays: number = DEFAULT_COOKIE_LIFE_DAYS,
): boolean {
  const capturedMs = Date.parse(capturedAt);
  if (Number.isNaN(capturedMs)) return true;

  const expiresMs = capturedMs + cookieLifeDays * SECONDS_PER_DAY * 1000;
  return Date.now() > expiresMs;
}

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export function resolveReferralAttributionFromCookie(
  cookieStore: CookieStore,
): ReferralAttribution | null {
  const raw = cookieStore.get(REFERRAL_COOKIE_NAME)?.value;
  return parseReferralCookieValue(raw);
}
