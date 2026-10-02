"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  isApplicationSubmitted,
  emptyApplication,
  parseApplicationData,
  toCompanyFields,
  toContactFields,
  validateSubmission,
} from "@/partner-center/lib/application-map";
import { findLinkedCompany, resolvePartner } from "@/partner-center/lib/resolve-partner";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import type { ApplicationData } from "@/partner-center/types/application";
import { notifyApplicationSubmitted } from "@/super-admin/partner-center/lib/notifications/create-notification";

type ActionResult = { error?: string };

async function persistApplication(
  incoming: ApplicationData,
  submitted: boolean,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to save a partner application." };
  }

  const session = await getSessionProfile();
  if (!session) return { error: "Sign in to continue." };

  const entitled = session.entitlements.some(
    (item) =>
      item.product === "partner_center" &&
      (item.status === "active" || item.status === "trial"),
  );
  if (!entitled) return { error: "Partner Center access is not available for this account." };

  const supabase = await createClient();
  const context = await resolvePartner(session.user, session.entitlements);
  const status = context?.profile?.status;
  if (status === "approved" || status === "active") {
    return { error: "This partner account is already approved." };
  }
  if (status === "declined") {
    return { error: "This application is closed." };
  }
  if (status && isApplicationSubmitted(context?.profile?.application_data) && !submitted) {
    return { error: "This application is already under review." };
  }

  const stored = parseApplicationData(
    context?.profile?.application_data,
    session.user.email,
  );
  const wasSubmitted = stored.submitted === true;
  const identityEmail = session.user.email.trim();
  const data: ApplicationData = {
    ...parseApplicationData(incoming, session.user.email),
    submitted,
    email: identityEmail || incoming.email.trim(),
    info_request: stored.info_request,
    decline_reason: stored.decline_reason,
    agreement_signed_at: stored.agreement_signed_at,
    programs_confirmed_at: stored.programs_confirmed_at,
    guide_acknowledged_at: stored.guide_acknowledged_at,
    address: incoming.address || stored.address,
  };

  if (submitted) {
    const invalid = validateSubmission(data);
    if (invalid) return { error: invalid };
  }

  const contactName =
    data.primary_contact_name.trim() ||
    (data.applying_as === "individual" ? data.legal_name : "");
  const contactFields = toContactFields({
    ...data,
    email: identityEmail || data.email,
    primary_contact_name: contactName,
  });
  const companyFields = toCompanyFields(data);

  let contactId = context?.contact?.id;
  if (contactId) {
    const { error } = await supabase
      .from("contacts")
      .update(contactFields)
      .eq("id", contactId);
    if (error) return { error: partnerFacingError("Could not save your application.", error.message) };
  } else {
    const email = contactFields.email;
    if (email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      contactId = existing?.id as string | undefined;
    }

    if (contactId) {
      const { error } = await supabase
        .from("contacts")
        .update(contactFields)
        .eq("id", contactId);
      if (error) return { error: partnerFacingError("Could not save your application.", error.message) };
    } else {
      const { data: created, error } = await supabase
        .from("contacts")
        .insert(contactFields)
        .select("id")
        .single();
      if (error || !created) return { error: partnerFacingError("Could not save the contact.", error?.message) };
      contactId = created.id as string;
    }
  }

  let companyId = context?.company?.id ?? context?.profile?.company_id;
  if (!companyId && contactId) {
    const linked = await findLinkedCompany(supabase, contactId);
    companyId = linked?.id;
  }
  if (companyId) {
    const { error } = await supabase
      .from("companies")
      .update(companyFields)
      .eq("id", companyId);
    if (error) return { error: partnerFacingError("Could not save your application.", error.message) };
  } else {
    const { data: created, error } = await supabase
      .from("companies")
      .insert(companyFields)
      .select("id")
      .single();
    if (error || !created) return { error: partnerFacingError("Could not save the company.", error?.message) };
    companyId = created.id as string;
  }

  const { data: existingLink } = await supabase
    .from("company_contacts")
    .select("id")
    .eq("company_id", companyId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (!existingLink) {
    const { error } = await supabase.from("company_contacts").insert({
      company_id: companyId,
      contact_id: contactId,
      is_primary: true,
    });
    if (error) return { error: partnerFacingError("Could not save your application.", error.message) };
  }

  const profileFields = {
    company_id: companyId,
    primary_contact_id: contactId,
    status: context?.profile?.status ?? "applied",
    partner_type: data.applying_as,
    application_data: data,
  };

  const writer = createAdminClient() ?? supabase;

  let profileId = context?.profile?.id;
  if (!profileId) {
    const { data: existingProfile } = await writer
      .from("partner_profiles")
      .select("id")
      .eq("primary_contact_id", contactId)
      .limit(1)
      .maybeSingle();
    profileId = existingProfile?.id as string | undefined;
  }
  if (profileId) {
    const { error } = await writer
      .from("partner_profiles")
      .update(profileFields)
      .eq("id", profileId);
    if (error) return { error: partnerFacingError("Could not save your application.", error.message) };
  } else {
    const { data: created, error } = await writer
      .from("partner_profiles")
      .insert(profileFields)
      .select("id")
      .single();
    if (error || !created) {
      return { error: partnerFacingError("Could not save the partner application.", error?.message) };
    }
    profileId = created.id as string;
  }

  const { data: existingMember } = await writer
    .from("partner_team_members")
    .select("id")
    .eq("partner_profile_id", profileId)
    .eq("contact_id", contactId)
    .maybeSingle();

  if (!existingMember) {
    const { error } = await writer.from("partner_team_members").insert({
      partner_profile_id: profileId,
      contact_id: contactId,
      function: "company_admin",
      access_level: "admin",
    });
    if (error) return { error: partnerFacingError("Could not save your application.", error.message) };
  }

  const { data: existingRole } = await supabase
    .from("contact_roles")
    .select("id")
    .eq("contact_id", contactId)
    .eq("related_type", "partner_profile")
    .eq("related_id", profileId)
    .eq("role_label", "partner_company_admin")
    .maybeSingle();

  if (!existingRole) {
    const { error } = await supabase.from("contact_roles").insert({
      contact_id: contactId,
      related_type: "partner_profile",
      related_id: profileId,
      role_label: "partner_company_admin",
      workspace_id: null,
    });
    if (error) return { error: partnerFacingError("Could not save your application.", error.message) };
  }

  if (submitted && !wasSubmitted && profileId) {
    const companyName =
      context?.company?.name?.trim() ||
      data.legal_name.trim() ||
      "Partner";
    const applicantName =
      contactName.trim() ||
      data.primary_contact_name.trim() ||
      identityEmail ||
      "Applicant";
    await notifyApplicationSubmitted({
      profileId,
      applicantName,
      companyName,
    });
  }

  return {};
}

export async function saveApplicationDraft(
  incoming: ApplicationData,
): Promise<ActionResult> {
  return persistApplication({ ...incoming, submitted: false }, false);
}

export async function submitApplication(
  incoming: ApplicationData,
): Promise<ActionResult> {
  return persistApplication({ ...incoming, submitted: true, current_step: 4 }, true);
}

/** Declined applicants may start a fresh application on the same partner profile. */
export async function reapplyPartnerApplication(): Promise<{
  error?: string;
  redirect?: string;
}> {
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

  const context = await resolvePartner(session.user, session.entitlements);
  const profile = context?.profile;
  if (!profile) return { error: "No partner application was found." };
  if (profile.status !== "declined") {
    return { error: "Only a declined application can be restarted." };
  }

  const fresh = emptyApplication(session.user.email);
  const writer = createAdminClient() ?? (await createClient());
  const { error } = await writer
    .from("partner_profiles")
    .update({
      status: "applied",
      partner_type: null,
      agreement_status: null,
      agreement_document_id: null,
      application_data: fresh,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) return { error: partnerFacingError("Could not save your application.", error.message) };

  return { redirect: PARTNER_PATHS.onboarding };
}
