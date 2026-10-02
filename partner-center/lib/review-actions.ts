"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  parseApplicationData,
} from "@/partner-center/lib/application-map";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";
import { PARTNER_PATHS, isAgreementSigned } from "@/partner-center/lib/review-state";
import type { ApplicationData } from "@/partner-center/types/application";
import type { PartnerContext } from "@/partner-center/types/partner";
import { notifyApplicationInfoResubmitted } from "@/super-admin/partner-center/lib/notifications/create-notification";

type ActionResult = { error?: string; redirect?: string };
type WriterOk = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: PartnerContext;
};

async function partnerWriter(): Promise<{ error: string } | WriterOk> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to continue." };
  }
  const session = await getSessionProfile();
  if (!session) return { error: "Sign in to continue." };
  const entitled = session.entitlements.some(
    (item) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
  if (!entitled) {
    return { error: "Partner Center access is not available for this account." };
  }
  const supabase = await createClient();
  const context = await resolvePartner(session.user, session.entitlements);
  if (!context?.profile) return { error: "No partner application was found." };
  return { supabase, context };
}

export async function resubmitRequestedInfo(incoming: {
  response: string;
}): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };

  const { supabase, context } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner application was found." };
  if (profile.status !== "applied" && profile.status !== "under_review") {
    return { error: "This application is not waiting on more information." };
  }

  const current = parseApplicationData(profile.application_data);
  if (!current.info_request?.active) {
    return { error: "No additional information was requested." };
  }

  const response = incoming.response.trim();
  if (!response) return { error: "Enter a reply with the details they asked for." };

  const data: ApplicationData = {
    ...current,
    submitted: true,
    info_request: {
      active: false,
      message: current.info_request.message,
      response,
    },
  };

  const { error } = await supabase
    .from("partner_profiles")
    .update({
      status: "under_review",
      application_data: data,
    })
    .eq("id", profile.id);
  if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };

  const companyName =
    context.company?.name?.trim() ||
    current.legal_name.trim() ||
    "Partner";
  const applicantName =
    current.primary_contact_name.trim() ||
    (current.applying_as === "individual" ? current.legal_name.trim() : "") ||
    current.email.trim() ||
    "Applicant";
  await notifyApplicationInfoResubmitted({
    profileId: profile.id,
    applicantName,
    companyName,
  });

  return { redirect: PARTNER_PATHS.pending };
}

export async function acceptPartnerAgreement(): Promise<ActionResult> {
  const loaded = await partnerWriter();
  if ("error" in loaded) return { error: loaded.error };

  const { supabase, context } = loaded;
  const profile = context.profile;
  if (!profile) return { error: "No partner application was found." };
  if (profile.status !== "approved") {
    return { error: "The agreement is available after approval." };
  }
  if (isAgreementSigned(profile.agreement_status)) {
    return { redirect: PARTNER_PATHS.agreementSigned };
  }

  const signedAt = new Date().toISOString();
  const data: ApplicationData = {
    ...parseApplicationData(profile.application_data),
    agreement_signed_at: signedAt,
  };

  const { error } = await supabase
    .from("partner_profiles")
    .update({
      agreement_status: "signed",
      application_data: data,
    })
    .eq("id", profile.id);
  if (error) return { error: partnerFacingError("Could not save your changes.", error.message) };

  profile.agreement_status = "signed";
  profile.application_data = data;

  const session = await getSessionProfile();
  if (session?.user.id) {
    const { ensureAgreementDocument } = await import(
      "@/partner-center/documents/lib/ensure-agreement-document"
    );
    await ensureAgreementDocument({
      context: { ...context, profile },
      userId: session.user.id,
    });
  }

  return { redirect: PARTNER_PATHS.agreementSigned };
}
