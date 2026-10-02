import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REFERRAL_SOURCE,
  REFERRAL_STATUS,
} from "@/partner-center/lib/referral-capture/constants";
import type {
  EngagedReferralProgram,
  ReferralProgram,
} from "@/partner-center/lib/referral-capture/infer-program";
import { findOrCreateContactByEmail } from "@/partner-center/lib/referral-capture/find-or-create-contact";
import { isReferralCookieExpired } from "@/partner-center/lib/referral-capture/parse-referral-cookie";
import type { SignupReferralResult } from "@/partner-center/lib/referral-capture/types";
import { validateReferralCodeWithClient } from "@/partner-center/lib/referral-capture/validate-referral-code";

type OpenByCodeInput = {
  userId: string;
  email: string;
  fullName?: string;
  program: ReferralProgram;
  referralCode: string;
  capturedAt?: string;
};

type SiblingRow = {
  partner_profile_id: string;
  referral_code_id: string;
  referred_contact_id: string | null;
};

/** Idempotent insert of one program referral row from a validated code. */
export async function openProgramReferralByCode(
  supabase: SupabaseClient,
  input: OpenByCodeInput,
): Promise<SignupReferralResult> {
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

  const { data: existing } = await supabase
    .from("partner_referrals")
    .select("id")
    .eq("referred_user_id", input.userId)
    .eq("referral_code_id", validated.referralCodeId)
    .eq("program", input.program)
    .maybeSingle();

  if (existing?.id) {
    return { referralId: existing.id as string, created: false };
  }

  // First-touch: if this user already has any referral for this program, keep it.
  try {
    const { loadPlatformAttributionConfig } = await import(
      "@/super-admin/partner-center/services/platform-attribution-config"
    );
    const config = await loadPlatformAttributionConfig(supabase);
    if (config.attributionMode === "first_touch") {
      const { data: priorForProgram } = await supabase
        .from("partner_referrals")
        .select("id, partner_profile_id")
        .eq("referred_user_id", input.userId)
        .eq("program", input.program)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (priorForProgram?.id) {
        return { referralId: priorForProgram.id as string, created: false };
      }
    }
  } catch {
    // default keep first-touch behavior on error
    const { data: priorForProgram } = await supabase
      .from("partner_referrals")
      .select("id")
      .eq("referred_user_id", input.userId)
      .eq("program", input.program)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (priorForProgram?.id) {
      return { referralId: priorForProgram.id as string, created: false };
    }
  }

  const contactId = await findOrCreateContactByEmail(supabase, {
    email: input.email,
    fullName: input.fullName,
  });
  if (!contactId) return { created: false };

  const { data: created, error } = await supabase
    .from("partner_referrals")
    .insert({
      partner_profile_id: validated.partnerProfileId,
      referral_code_id: validated.referralCodeId,
      referred_user_id: input.userId,
      referred_contact_id: contactId,
      program: input.program,
      product: null,
      source: REFERRAL_SOURCE,
      status: REFERRAL_STATUS,
      referral_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !created?.id) return { created: false };

  const { notifyPartnerNewReferral } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  void notifyPartnerNewReferral({
    admin: supabase,
    partnerProfileId: validated.partnerProfileId,
    referralId: created.id as string,
    program: input.program,
  }).catch((error: unknown) => {
    console.error(
      "[openProgramReferralByCode] partner notification failed",
      created.id,
      error,
    );
  });

  return { referralId: created.id as string, created: true };
}

/** Clone partner/code/contact from an existing referral onto another program. */
export async function openProgramReferralFromSibling(
  supabase: SupabaseClient,
  input: {
    userId: string;
    program: EngagedReferralProgram;
    sibling: SiblingRow;
  },
): Promise<SignupReferralResult> {
  const { data: existing } = await supabase
    .from("partner_referrals")
    .select("id")
    .eq("referred_user_id", input.userId)
    .eq("referral_code_id", input.sibling.referral_code_id)
    .eq("program", input.program)
    .maybeSingle();

  if (existing?.id) {
    return { referralId: existing.id as string, created: false };
  }

  const { data: created, error } = await supabase
    .from("partner_referrals")
    .insert({
      partner_profile_id: input.sibling.partner_profile_id,
      referral_code_id: input.sibling.referral_code_id,
      referred_user_id: input.userId,
      referred_contact_id: input.sibling.referred_contact_id,
      program: input.program,
      product: null,
      source: REFERRAL_SOURCE,
      status: REFERRAL_STATUS,
      referral_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !created?.id) return { created: false };

  const { notifyPartnerNewReferral } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  void notifyPartnerNewReferral({
    admin: supabase,
    partnerProfileId: input.sibling.partner_profile_id,
    referralId: created.id as string,
    program: input.program,
  }).catch((error: unknown) => {
    console.error(
      "[openProgramReferralFromSibling] partner notification failed",
      created.id,
      error,
    );
  });

  return { referralId: created.id as string, created: true };
}

export async function findSiblingReferral(
  supabase: SupabaseClient,
  userId: string,
): Promise<SiblingRow | null> {
  const { data } = await supabase
    .from("partner_referrals")
    .select("partner_profile_id, referral_code_id, referred_contact_id")
    .eq("referred_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.partner_profile_id || !data?.referral_code_id) return null;
  return data as SiblingRow;
}

export async function findExistingProgramReferral(
  supabase: SupabaseClient,
  userId: string,
  program: ReferralProgram,
): Promise<string | null> {
  const { data } = await supabase
    .from("partner_referrals")
    .select("id")
    .eq("referred_user_id", userId)
    .eq("program", program)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Latest open unsigned Platform referral (program = platform). */
export async function findOpenSharedReferral(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("partner_referrals")
    .select("id")
    .eq("referred_user_id", userId)
    .eq("program", "platform")
    .in("status", ["referred", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Promote unsigned platform → academy|whitbyos in place (first product engagement). */
export async function promoteSharedReferral(
  supabase: SupabaseClient,
  referralId: string,
  program: EngagedReferralProgram,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("partner_referrals")
    .update({ program })
    .eq("id", referralId)
    .eq("program", "platform")
    .select("id")
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}
