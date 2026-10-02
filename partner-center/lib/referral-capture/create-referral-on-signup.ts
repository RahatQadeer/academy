import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import type { ReferralProgram } from "@/partner-center/lib/referral-capture/infer-program";
import { openProgramReferralByCode } from "@/partner-center/lib/referral-capture/open-program-referral";
import { isReferralCookieExpired } from "@/partner-center/lib/referral-capture/parse-referral-cookie";
import { persistReferralIdentity } from "@/partner-center/lib/referral-capture/referral-identity";
import type {
  SignupReferralInput,
  SignupReferralResult,
} from "@/partner-center/lib/referral-capture/types";
import { validateReferralCodeWithClient } from "@/partner-center/lib/referral-capture/validate-referral-code";

/**
 * Shared / omitted → platform (UI "Whitby") until first product entry.
 * Shared wins over a stale product-scoped cookie from an earlier visit.
 * Academy-scoped → academy. Whitby-scoped → whitbyos.
 */
function programsToCreate(input: SignupReferralInput): ReferralProgram[] {
  if (input.shared === true || !input.program) return ["platform"];
  if (input.program === "academy") return ["academy"];
  if (input.program === "whitbyos") return ["whitbyos"];
  return ["platform"];
}

export async function createPartnerReferralOnSignupWithClient(
  supabase: SupabaseClient,
  input: SignupReferralInput,
): Promise<SignupReferralResult> {
  if (input.isNewSignup === false) {
    return { created: false };
  }

  const validated = await validateReferralCodeWithClient(
    supabase,
    input.referralCode,
  );
  if (!validated) return { created: false };

  if (
    input.capturedAt &&
    isReferralCookieExpired(input.capturedAt, validated.cookieLifeDays)
  ) {
    return { created: false };
  }

  try {
    await persistReferralIdentity(
      supabase,
      input.userId,
      validated.code,
      input.capturedAt,
    );
  } catch {
    // Row creation may still succeed; purchase ensure can use sibling if any.
  }

  const programs = programsToCreate(input);
  let createdAny = false;
  let firstReferralId: string | undefined;

  for (const program of programs) {
    const result = await openProgramReferralByCode(supabase, {
      userId: input.userId,
      email: input.email,
      fullName: input.fullName,
      program,
      referralCode: validated.code,
      capturedAt: input.capturedAt,
    });
    if (result.referralId) {
      firstReferralId ??= result.referralId;
    }
    if (result.created) createdAny = true;
  }

  if (!firstReferralId) return { created: false };
  return { referralId: firstReferralId, created: createdAny };
}

export async function createPartnerReferralOnSignup(
  input: SignupReferralInput,
  supabase?: SupabaseClient,
): Promise<SignupReferralResult> {
  const client = supabase ?? createAdminClient();
  if (!client) return { created: false };

  try {
    return await createPartnerReferralOnSignupWithClient(client, input);
  } catch {
    return { created: false };
  }
}
