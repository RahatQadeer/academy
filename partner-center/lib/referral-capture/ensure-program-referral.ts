import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import type { EngagedReferralProgram } from "@/partner-center/lib/referral-capture/infer-program";
import {
  findExistingProgramReferral,
  findOpenSharedReferral,
  findSiblingReferral,
  openProgramReferralByCode,
  openProgramReferralFromSibling,
  promoteSharedReferral,
} from "@/partner-center/lib/referral-capture/open-program-referral";
import {
  readReferralIdentityFromUser,
  resolveUserEmail,
} from "@/partner-center/lib/referral-capture/referral-identity";
import type { SignupReferralResult } from "@/partner-center/lib/referral-capture/types";

export type EnsureProgramReferralInput = {
  userId: string;
  program: EngagedReferralProgram;
  email?: string;
  fullName?: string;
  referralCode?: string;
  capturedAt?: string;
};

/**
 * Open one program referral when the user engages that product.
 * Prefer promote unsigned platform → target, then sibling clone, then code / Auth metadata.
 */
export async function ensureProgramReferralForUser(
  supabase: SupabaseClient,
  input: EnsureProgramReferralInput,
): Promise<SignupReferralResult> {
  const existingId = await findExistingProgramReferral(
    supabase,
    input.userId,
    input.program,
  );
  if (existingId) {
    return { referralId: existingId, created: false };
  }

  const sharedId = await findOpenSharedReferral(supabase, input.userId);
  if (sharedId) {
    const promoted = await promoteSharedReferral(
      supabase,
      sharedId,
      input.program,
    );
    if (promoted) {
      return { referralId: promoted, created: false };
    }
  }

  const sibling = await findSiblingReferral(supabase, input.userId);
  if (sibling) {
    return openProgramReferralFromSibling(supabase, {
      userId: input.userId,
      program: input.program,
      sibling,
    });
  }

  let code = input.referralCode?.trim() || "";
  let capturedAt = input.capturedAt;
  if (!code) {
    const stored = await readReferralIdentityFromUser(supabase, input.userId);
    if (stored) {
      code = stored.code;
      capturedAt ??= stored.capturedAt;
    }
  }
  if (!code) return { created: false };

  let email = input.email?.trim() || "";
  let fullName = input.fullName;
  if (!email) {
    const resolved = await resolveUserEmail(supabase, input.userId);
    if (!resolved) return { created: false };
    email = resolved.email;
    fullName ??= resolved.fullName;
  }

  return openProgramReferralByCode(supabase, {
    userId: input.userId,
    email,
    fullName,
    program: input.program,
    referralCode: code,
    capturedAt,
  });
}

export async function ensureProgramReferralForUserSafe(
  input: EnsureProgramReferralInput,
  supabase?: SupabaseClient,
): Promise<SignupReferralResult> {
  const client = supabase ?? createAdminClient();
  if (!client) return { created: false };
  try {
    return await ensureProgramReferralForUser(client, input);
  } catch {
    return { created: false };
  }
}
