import "server-only";

import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import type { PartnerAdminNotificationKind } from "@/super-admin/partner-center/lib/notifications/types";

export type CreatePartnerAdminNotificationInput = {
  kind: PartnerAdminNotificationKind;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  channel?: "partner_manager" | "support_billing";
};

export async function createPartnerAdminNotification(
  input: CreatePartnerAdminNotificationInput,
): Promise<{ ok: boolean; error?: string; notificationId?: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Admin client is not configured." };
  }

  const { data, error } = await admin
    .from("partner_admin_notifications")
    .insert({
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      channel: input.channel ?? "support_billing",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message ?? "Could not create admin notification.",
    };
  }

  return { ok: true, notificationId: data.id as string };
}

export async function notifyApplicationSubmitted(input: {
  profileId: string;
  applicantName: string;
  companyName: string;
}): Promise<void> {
  await createPartnerAdminNotification({
    kind: "application_submitted",
    title: "New partner application submitted",
    body: `${input.companyName} — ${input.applicantName}`,
    href: `/partner-center/admin/applications/${input.profileId}`,
    entityType: "partner_application",
    entityId: input.profileId,
    channel: "partner_manager",
  });
}

export async function notifyApplicationInfoResubmitted(input: {
  profileId: string;
  applicantName: string;
  companyName: string;
}): Promise<void> {
  await createPartnerAdminNotification({
    kind: "application_info_resubmitted",
    title: "Partner replied with more information",
    body: `${input.companyName} — ${input.applicantName}`,
    href: `/partner-center/admin/applications/${input.profileId}`,
    entityType: "partner_application",
    entityId: input.profileId,
    channel: "partner_manager",
  });
}

export async function notifyOpportunitySubmitted(input: {
  opportunityId: string;
  companyName: string;
  partnerCompanyName: string;
}): Promise<void> {
  await createPartnerAdminNotification({
    kind: "opportunity_submitted",
    title: "New enterprise opportunity submitted",
    body: `${input.companyName} — submitted by ${input.partnerCompanyName}`,
    href: `/partner-center/admin/opportunities/${input.opportunityId}`,
    entityType: "partner_opportunity",
    entityId: input.opportunityId,
    channel: "partner_manager",
  });
}

export async function notifyPartnerMessage(input: {
  profileId: string;
  senderName: string;
  companyName: string;
  preview: string;
  channel?: "partner_manager" | "support_billing";
}): Promise<void> {
  const preview =
    input.preview.length > 120
      ? `${input.preview.slice(0, 117).trimEnd()}…`
      : input.preview;
  const channel = input.channel ?? "partner_manager";
  const href =
    channel === "partner_manager"
      ? `/partner-center/admin/messages/${input.profileId}?channel=partner_manager`
      : `/super-admin/partner-center/messages/${input.profileId}`;
  await createPartnerAdminNotification({
    kind: "partner_message",
    title: `Message from ${input.senderName}`,
    body: `${input.companyName} — ${preview}`,
    href,
    entityType: "partner_profile",
    entityId: input.profileId,
    channel,
  });
}
