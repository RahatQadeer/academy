import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { statusLabel } from "@/partner-center/opportunities/lib/format";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { parseNotificationPrefs } from "@/partner-center/settings/lib/notification-prefs";
import type { NotificationPrefs } from "@/partner-center/settings/types";
import type { PartnerNotificationKind } from "@/partner-center/lib/notifications/types";

export type NotifyPartnerResult = {
  ok: boolean;
  error?: string;
  notificationId?: string;
  skipped?: boolean;
};

type PrefKey = keyof NotificationPrefs;

function resolveWriter(admin?: SupabaseClient): SupabaseClient | null {
  return createAdminClient() ?? admin ?? null;
}

async function insertPartnerNotification(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  prefKey: PrefKey;
  kind: PartnerNotificationKind | string;
  title: string;
  body: string;
  href: string;
  entityType: string;
  entityId: string;
}): Promise<NotifyPartnerResult> {
  const admin = resolveWriter(input.admin);
  if (!admin) {
    return { ok: false, error: "Admin client is not configured." };
  }

  const { partnerProfileId, prefKey } = input;

  const { data: profile, error: profileError } = await admin
    .from("partner_profiles")
    .select("id, application_data")
    .eq("id", partnerProfileId)
    .maybeSingle();
  if (profileError) {
    return { ok: false, error: profileError.message };
  }
  if (!profile?.id) {
    return { ok: false, error: "Partner profile not found." };
  }

  const prefs = parseNotificationPrefs(profile.application_data);
  if (prefs[prefKey].in_app === false) {
    return { ok: true, skipped: true };
  }

  const { data, error } = await admin
    .from("partner_notifications")
    .insert({
      partner_profile_id: partnerProfileId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href: input.href,
      entity_type: input.entityType,
      entity_id: input.entityId,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message ?? "Could not create partner notification.",
    };
  }

  return { ok: true, notificationId: data.id as string };
}

function clipPreview(preview: string, max = 120): string {
  if (preview.length <= max) return preview;
  return `${preview.slice(0, max - 3).trimEnd()}…`;
}

export async function notifyPartnerOpportunityStatus(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  opportunityId: string;
  status: string;
}): Promise<NotifyPartnerResult> {
  const label = statusLabel(input.status);
  return insertPartnerNotification({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    prefKey: "opportunity_updates",
    kind: "opportunity_status",
    title: `Opportunity ${label.toLowerCase()}`,
    body: `Your enterprise opportunity is now ${label}.`,
    href: `/partner-center/opportunities/${input.opportunityId}`,
    entityType: "partner_opportunity",
    entityId: input.opportunityId,
  });
}

export async function notifyPartnerNewMessage(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  preview: string;
}): Promise<NotifyPartnerResult> {
  return insertPartnerNotification({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    prefKey: "new_message",
    kind: "new_message",
    title: "New message from Private Attaché",
    body: clipPreview(input.preview),
    href: "/partner-center/messages",
    entityType: "partner_profile",
    entityId: input.partnerProfileId,
  });
}

export async function notifyPartnerNewReferral(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  referralId: string;
  program?: string | null;
}): Promise<NotifyPartnerResult> {
  const program = input.program?.trim();
  return insertPartnerNotification({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    prefKey: "new_referral",
    kind: "new_referral",
    title: "New referral submitted",
    body: program
      ? `A new ${program} referral was submitted with your link.`
      : "A new referral was submitted with your link.",
    href: `/partner-center/referrals/${input.referralId}`,
    entityType: "partner_referral",
    entityId: input.referralId,
  });
}

export async function notifyPartnerReferralStatus(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  referralId: string;
  status: string;
}): Promise<NotifyPartnerResult> {
  const key = input.status.toLowerCase();
  const label =
    key === "in_progress"
      ? "In Progress"
      : key === "converted"
        ? "Converted"
        : key === "not_converted"
          ? "Not Converted"
          : input.status;

  return insertPartnerNotification({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    prefKey: "referral_status",
    kind: "referral_status",
    title: `Referral ${label.toLowerCase()}`,
    body: `Your referral is now ${label}.`,
    href: `/partner-center/referrals/${input.referralId}`,
    entityType: "partner_referral",
    entityId: input.referralId,
  });
}

export async function notifyPartnerEarningsPayable(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  count: number;
}): Promise<NotifyPartnerResult> {
  const n = Math.max(1, input.count);
  return insertPartnerNotification({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    prefKey: "earnings_payouts",
    kind: "earnings_payable",
    title: "Earnings ready",
    body:
      n === 1
        ? "An earning is now payable."
        : `${n} earnings are now payable.`,
    href: "/partner-center/earnings",
    entityType: "partner_profile",
    entityId: input.partnerProfileId,
  });
}

export async function notifyPartnerPayoutPaid(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  payoutId: string;
  amountLabel?: string | null;
}): Promise<NotifyPartnerResult> {
  const amount = input.amountLabel?.trim();
  return insertPartnerNotification({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    prefKey: "earnings_payouts",
    kind: "payout_paid",
    title: "Payout completed",
    body: amount
      ? `Your payout of ${amount} was completed.`
      : "Your payout was completed.",
    href: "/partner-center/earnings",
    entityType: "partner_payout",
    entityId: input.payoutId,
  });
}

export async function notifyPartnerActionNeeded(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  title: string;
  body: string;
  href: string;
  entityType?: string;
  entityId?: string;
}): Promise<NotifyPartnerResult> {
  return insertPartnerNotification({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    prefKey: "action_needed",
    kind: "action_needed",
    title: input.title,
    body: input.body,
    href: input.href,
    entityType: input.entityType ?? "partner_profile",
    entityId: input.entityId ?? input.partnerProfileId,
  });
}

export async function notifyPartnerDocumentActionNeeded(input: {
  admin?: SupabaseClient;
  partnerProfileId: string;
  documentId: string;
  title: string;
  body: string;
  href: string;
}): Promise<NotifyPartnerResult> {
  return notifyPartnerActionNeeded({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    title: input.title,
    body: input.body,
    href: input.href,
    entityType: "document",
    entityId: input.documentId,
  });
}
