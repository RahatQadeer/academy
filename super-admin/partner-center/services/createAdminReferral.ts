import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateContactByEmail } from "@/partner-center/lib/referral-capture/find-or-create-contact";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type CreateAdminReferralInput = {
  admin: SupabaseClient;
  actorUserId: string | null;
  partnerProfileId: string;
  program: "academy" | "whitbyos";
  reason: string;
  /** Preferred when known. */
  referredUserId?: string;
  /** Used when user id is omitted; also used to bind/create contact. */
  email?: string;
  fullName?: string;
};

export async function createAdminReferral(
  input: CreateAdminReferralInput,
): Promise<{ error?: string; referralId?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    return { error: "A reason is required for admin attribution." };
  }

  if (input.program !== "academy" && input.program !== "whitbyos") {
    return { error: "Program must be academy or whitbyos." };
  }

  const { data: partner, error: partnerError } = await input.admin
    .from("partner_profiles")
    .select("id, status")
    .eq("id", input.partnerProfileId)
    .maybeSingle();

  if (partnerError) return { error: partnerError.message };
  if (!partner) return { error: "Partner not found." };
  const partnerStatus = (partner.status as string).toLowerCase();
  if (partnerStatus !== "active" && partnerStatus !== "approved") {
    return { error: "Partner must be approved or active." };
  }

  let referredUserId = input.referredUserId?.trim() || null;
  let email = input.email?.trim().toLowerCase() || null;
  let fullName = input.fullName?.trim() || undefined;

  if (referredUserId) {
    const { data: user, error: userError } = await input.admin
      .from("users")
      .select("id, email, full_name, preferred_name")
      .eq("id", referredUserId)
      .maybeSingle();
    if (userError) return { error: userError.message };
    if (!user) return { error: "Referred user not found." };
    email = email || ((user.email as string | null)?.toLowerCase() ?? null);
    fullName =
      fullName ||
      (user.preferred_name as string | null)?.trim() ||
      (user.full_name as string | null)?.trim() ||
      undefined;
  } else if (email) {
    const { data: userByEmail } = await input.admin
      .from("users")
      .select("id, full_name, preferred_name")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (userByEmail?.id) {
      referredUserId = userByEmail.id as string;
      fullName =
        fullName ||
        (userByEmail.preferred_name as string | null)?.trim() ||
        (userByEmail.full_name as string | null)?.trim() ||
        undefined;
    }
  } else {
    return { error: "Provide a referred user id or email." };
  }

  if (!email) {
    return { error: "Could not resolve an email for the referred person." };
  }

  const contactId = await findOrCreateContactByEmail(input.admin, {
    email,
    fullName,
  });
  if (!contactId) {
    return { error: "Could not create or find a contact for the referred person." };
  }

  if (referredUserId) {
    const { data: existing } = await input.admin
      .from("partner_referrals")
      .select("id, partner_profile_id, status")
      .eq("referred_user_id", referredUserId)
      .eq("program", input.program)
      .in("status", ["referred", "in_progress", "converted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return {
        error: `An open or converted ${input.program} referral already exists for this user (${existing.id}). Use correct attribution to reassign.`,
      };
    }
  }

  const { data: link } = await input.admin
    .from("partner_links_codes")
    .select("id")
    .eq("partner_profile_id", input.partnerProfileId)
    .eq("type", "referral_link")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const referralDate = new Date().toISOString().slice(0, 10);
  const { data: created, error: insertError } = await input.admin
    .from("partner_referrals")
    .insert({
      partner_profile_id: input.partnerProfileId,
      referral_code_id: (link?.id as string | undefined) ?? null,
      referred_user_id: referredUserId,
      referred_contact_id: contactId,
      program: input.program,
      product: null,
      source: "admin",
      status: "referred",
      referral_date: referralDate,
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    return { error: insertError?.message ?? "Could not create referral." };
  }

  const audit = await writePartnerAdminAudit(input.admin, {
    actorUserId: input.actorUserId,
    entityType: "partner_referral",
    entityId: created.id as string,
    action: "create_attribution",
    previousValue: null,
    newValue: {
      partner_profile_id: input.partnerProfileId,
      program: input.program,
      referred_user_id: referredUserId,
      referred_contact_id: contactId,
      source: "admin",
      status: "referred",
    },
    reason,
  });

  if (audit.error) return { error: audit.error };

  const { notifyPartnerNewReferral } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  const notifyResult = await notifyPartnerNewReferral({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    referralId: created.id as string,
    program: input.program,
  });
  if (!notifyResult.ok) {
    console.error(
      "[createAdminReferral] partner notification failed",
      created.id,
      notifyResult.error,
    );
  }

  return { referralId: created.id as string };
}
