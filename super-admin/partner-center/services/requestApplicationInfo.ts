import type { SupabaseClient } from "@supabase/supabase-js";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export async function requestApplicationInfo(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  profileId: string;
  message: string;
}): Promise<{ error?: string }> {
  const { admin, actorUserId, profileId, message } = input;
  const trimmedMessage = message.trim();
  if (!trimmedMessage) return { error: "Enter a message for the applicant." };

  const { data: profile, error: loadError } = await admin
    .from("partner_profiles")
    .select("id, status, application_data")
    .eq("id", profileId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!profile) return { error: "Application not found." };

  const status = (profile.status as string).toLowerCase();
  if (status !== "applied" && status !== "under_review") {
    return { error: "This application is not pending review." };
  }

  const application = {
    ...parseApplicationData(profile.application_data),
    info_request: {
      active: true,
      message: trimmedMessage,
    },
  };

  const { error: updateError } = await admin
    .from("partner_profiles")
    .update({
      status: "under_review",
      application_data: application,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) return { error: updateError.message };

  const { notifyPartnerActionNeeded } = await import(
    "@/partner-center/lib/notifications/create-partner-notification"
  );
  const notifyResult = await notifyPartnerActionNeeded({
    admin,
    partnerProfileId: profileId,
    title: "Action needed on your application",
    body: clipPreview(trimmedMessage),
    href: "/partner-center/onboarding/more-info",
  });
  if (!notifyResult.ok) {
    console.error(
      "[requestApplicationInfo] partner notification failed",
      profileId,
      notifyResult.error,
    );
  }

  const audit = await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "partner_profile",
    entityId: profileId,
    action: "application_info_requested",
    previousValue: { status: profile.status },
    newValue: { status: "under_review" },
    reason: trimmedMessage,
  });

  if (audit.error) return { error: audit.error };
  return {};
}

function clipPreview(preview: string, max = 120): string {
  if (preview.length <= max) return preview;
  return `${preview.slice(0, max - 3).trimEnd()}…`;
}
