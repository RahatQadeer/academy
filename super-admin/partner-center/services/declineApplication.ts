import type { SupabaseClient } from "@supabase/supabase-js";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export async function declineApplication(input: {
  admin: SupabaseClient;
  actorUserId: string | null;
  profileId: string;
  reason: string;
}): Promise<{ error?: string }> {
  const { admin, actorUserId, profileId, reason } = input;
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: "Enter a decline reason." };

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
    decline_reason: trimmedReason,
    info_request: undefined,
  };

  const { error: updateError } = await admin
    .from("partner_profiles")
    .update({
      status: "declined",
      application_data: application,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  if (updateError) return { error: updateError.message };

  const audit = await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "partner_profile",
    entityId: profileId,
    action: "application_declined",
    previousValue: { status: profile.status },
    newValue: { status: "declined" },
    reason: trimmedReason,
  });

  if (audit.error) return { error: audit.error };
  return {};
}
