"use server";

import { revalidatePath } from "next/cache";
import type { PartnerProgramFamily } from "@/partner-center/types/application";
import { partnerAdminWriter } from "@/partner-center/admin/lib/partner-admin-writer";
import { PA_ADMIN } from "@/partner-center/admin/lib/paths";
import { approveApplication } from "@/super-admin/partner-center/services/approveApplication";
import { declineApplication } from "@/super-admin/partner-center/services/declineApplication";
import { requestApplicationInfo } from "@/super-admin/partner-center/services/requestApplicationInfo";
import {
  updateOpportunityStatus,
  type OpportunityAdminAction,
} from "@/super-admin/partner-center/services/updateOpportunityStatus";
import { sendStaffMessage } from "@/super-admin/partner-center/messages/services/sendStaffMessage";
import { after } from "next/server";
import { notifyPartnerNewMessage } from "@/partner-center/lib/notifications/create-partner-notification";

type ActionResult = { error?: string; ok?: boolean };

const ALLOWED_OPP_ACTIONS = new Set<OpportunityAdminAction>([
  "accept",
  "in_progress",
  "not_moving_forward",
]);

function revalidateApplication(profileId: string) {
  revalidatePath(PA_ADMIN.applications);
  revalidatePath(PA_ADMIN.application(profileId));
  revalidatePath(PA_ADMIN.partners);
  revalidatePath(PA_ADMIN.partner(profileId));
}

export async function partnerAdminApproveApplicationAction(input: {
  profileId: string;
  programs: PartnerProgramFamily[];
}): Promise<ActionResult> {
  const loaded = await partnerAdminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await approveApplication({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    profileId: input.profileId,
    programs: input.programs,
  });
  if (result.error) return { error: result.error };
  revalidateApplication(input.profileId);
  return { ok: true };
}

export async function partnerAdminDeclineApplicationAction(input: {
  profileId: string;
  reason: string;
}): Promise<ActionResult> {
  const loaded = await partnerAdminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await declineApplication({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    profileId: input.profileId,
    reason: input.reason,
  });
  if (result.error) return { error: result.error };
  revalidateApplication(input.profileId);
  return { ok: true };
}

export async function partnerAdminRequestApplicationInfoAction(input: {
  profileId: string;
  message: string;
}): Promise<ActionResult> {
  const loaded = await partnerAdminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await requestApplicationInfo({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    profileId: input.profileId,
    message: input.message,
  });
  if (result.error) return { error: result.error };
  revalidateApplication(input.profileId);
  return { ok: true };
}

export async function partnerAdminUpdateOpportunityStatusAction(input: {
  opportunityId: string;
  action: OpportunityAdminAction;
}): Promise<ActionResult> {
  if (!ALLOWED_OPP_ACTIONS.has(input.action)) {
    return { error: "That action is not available." };
  }

  const loaded = await partnerAdminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await updateOpportunityStatus({
    admin: loaded.admin,
    actorUserId: loaded.actorUserId,
    opportunityId: input.opportunityId,
    action: input.action,
  });
  if (result.error) return { error: result.error };
  revalidatePath(PA_ADMIN.opportunities);
  revalidatePath(PA_ADMIN.opportunity(input.opportunityId));
  return { ok: true };
}

export async function partnerAdminSendMessageAction(input: {
  profileId: string;
  body: string;
}): Promise<ActionResult> {
  const loaded = await partnerAdminWriter();
  if ("error" in loaded) return { error: loaded.error };

  const result = await sendStaffMessage({
    admin: loaded.admin,
    profileId: input.profileId,
    body: input.body,
    channel: "partner_manager",
  });
  if (result.error) return { error: result.error };

  after(() => {
    void (async () => {
      await loaded.admin.from("partner_message_staff_reads").upsert(
        {
          partner_profile_id: input.profileId,
          channel: "partner_manager",
          last_read_at: new Date().toISOString(),
          reader_user_id: loaded.actorUserId,
        },
        { onConflict: "partner_profile_id,channel" },
      );
      await notifyPartnerNewMessage({
        admin: loaded.admin,
        partnerProfileId: input.profileId,
        preview: input.body.trim(),
      });
    })();
  });

  revalidatePath(PA_ADMIN.messages);
  revalidatePath(PA_ADMIN.message(input.profileId));
  return { ok: true };
}
