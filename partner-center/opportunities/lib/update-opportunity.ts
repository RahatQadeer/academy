"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import {
  partnerCanMutateOpportunities,
  isOpportunityEditable,
} from "@/partner-center/opportunities/lib/can-mutate";
import { packOpportunityNotes } from "@/partner-center/opportunities/lib/notes";
import {
  isValidEmail,
  isValidPhoneLocal,
  parsePhoneWithCountry,
} from "@/partner-center/opportunities/lib/contact-fields";
import { loadProductInterestOptions } from "@/partner-center/opportunities/lib/product-interest-options";
import {
  parseProductInterests,
  resolveSubmittedProductInterests,
} from "@/partner-center/opportunities/lib/product-interest-shared";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { createPartnerAdminNotification } from "@/super-admin/partner-center/lib/notifications/create-notification";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";

export type UpdateOpportunityResult = {
  error?: string;
  opportunityId?: string;
};

const BUCKET = "documents";
const MAX_BYTES = 25 * 1024 * 1024;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

async function uploadAttachment(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  file: File;
  partnerProfileId: string;
  userId: string;
}): Promise<{ documentId?: string; error?: string }> {
  if (input.file.size === 0) return {};
  if (input.file.size > MAX_BYTES) {
    return { error: "Attachments must be 25 MB or smaller." };
  }

  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_");
  const path = `partner/${input.partnerProfileId}/opportunities/${Date.now()}-${safeName}`;

  const { error: uploadError } = await input.supabase.storage
    .from(BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return { error: partnerFacingError("Could not upload the attachment.", uploadError.message) };
  }

  const { data: document, error } = await input.supabase
    .from("documents")
    .insert({
      title: input.file.name,
      file_url: path,
      context_type: "partner_profile",
      context_id: input.partnerProfileId,
      visibility: "internal",
      status: "current",
      version: 1,
      uploaded_by_user_id: input.userId,
    })
    .select("id")
    .single();

  if (error || !document) {
    await input.supabase.storage.from(BUCKET).remove([path]);
    return {
      error: partnerFacingError("Could not save the attachment document.", error?.message),
    };
  }

  return { documentId: document.id as string };
}

export async function updateOpportunity(
  opportunityId: string,
  formData: FormData,
): Promise<UpdateOpportunityResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to update an opportunity." };
  }

  const { user, context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) {
    return { error: "Partner profile is required to update an opportunity." };
  }
  if (!user.id || user.id === "preview") {
    return { error: "Sign in to update an opportunity." };
  }
  if (!partnerCanMutateOpportunities(context)) {
    return { error: "Your access level cannot edit opportunities." };
  }
  if (!opportunityId) {
    return { error: "Opportunity not found." };
  }

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("partner_opportunities")
    .select(
      "id, status, company_id, primary_contact_id, attachment_document_id, partner_profile_id, product_interest",
    )
    .eq("id", opportunityId)
    .eq("partner_profile_id", profile.id)
    .maybeSingle();

  if (loadError) return { error: partnerFacingError("Could not update the opportunity.", loadError.message) };
  if (!existing) return { error: "Opportunity not found." };

  const status = existing.status as string;
  if (!isOpportunityEditable(status)) {
    return {
      error:
        "This opportunity can no longer be edited once it is in progress or later.",
    };
  }

  const companyName = text(formData, "companyName");
  const contactName = text(formData, "contactName");
  const contactEmail = text(formData, "contactEmail").toLowerCase();
  const contactTitle = text(formData, "contactTitle");
  const contactPhone = text(formData, "contactPhone");
  const website = normalizeWebsite(text(formData, "website"));
  const productInterest = text(formData, "productInterest");
  const timing = text(formData, "expectedTiming");
  const contextNotes = text(formData, "additionalContext");
  const permissionRaw = text(formData, "permissionToContact");
  const permissionToContact =
    permissionRaw === "true" || permissionRaw === "on" || permissionRaw === "1";

  if (!companyName) return { error: "Company name is required." };
  if (!contactName) return { error: "Contact name is required." };
  if (!contactEmail || !isValidEmail(contactEmail)) {
    return { error: "A valid contact email is required." };
  }
  if (contactPhone) {
    const { local } = parsePhoneWithCountry(contactPhone);
    if (!isValidPhoneLocal(local)) {
      return {
        error: "Enter a valid contact phone number, or leave it blank.",
      };
    }
  }
  const currentInterest =
    (existing.product_interest as string | null)?.trim() || undefined;
  const interestOptions = await loadProductInterestOptions(supabase, {
    activeOnly: true,
    includeValues: currentInterest
      ? parseProductInterests(currentInterest)
      : [],
  });
  const interestResolved = resolveSubmittedProductInterests(
    productInterest,
    interestOptions,
  );
  if (!interestResolved.ok) {
    return { error: interestResolved.error };
  }
  const productInterestStored = interestResolved.value;
  if (!permissionToContact) {
    return {
      error:
        "Permission to share this contact's information is required before saving.",
    };
  }

  const seatsRaw = text(formData, "estimatedSeats");
  let estimatedSeats: number | null = null;
  if (seatsRaw) {
    const parsed = Number(seatsRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      return { error: "Estimated users / seats must be a whole number." };
    }
    estimatedSeats = parsed;
  }

  const valueRaw = text(formData, "estimatedValue").replace(/[$,]/g, "");
  let estimatedValue: number | null = null;
  if (valueRaw) {
    const parsed = Number(valueRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: "Estimated value must be a valid number." };
    }
    estimatedValue = parsed;
  }

  const notes = packOpportunityNotes(timing || null, contextNotes || null);
  const { first_name, last_name } = splitName(contactName);

  let attachmentDocumentId =
    (existing.attachment_document_id as string | null) ?? null;
  const attachment = formData.get("attachment");
  if (attachment instanceof File && attachment.size > 0) {
    const uploaded = await uploadAttachment({
      supabase,
      file: attachment,
      partnerProfileId: profile.id,
      userId: user.id,
    });
    if (uploaded.error) return { error: uploaded.error };
    attachmentDocumentId = uploaded.documentId ?? attachmentDocumentId;
  }

  let contactId: string | undefined;
  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .ilike("email", contactEmail)
    .limit(1)
    .maybeSingle();

  const contactFields = {
    first_name: first_name || contactName,
    last_name: last_name || "",
    email: contactEmail,
    phone: contactPhone || null,
    title_role: contactTitle || null,
    source: "partner_opportunity",
    created_by_workspace_id: null,
  };

  if (existingContact?.id) {
    contactId = existingContact.id as string;
    const { error } = await supabase
      .from("contacts")
      .update(contactFields)
      .eq("id", contactId);
    if (error) return { error: partnerFacingError("Could not update the opportunity.", error.message) };
  } else {
    const { data: created, error } = await supabase
      .from("contacts")
      .insert(contactFields)
      .select("id")
      .single();
    if (error || !created) {
      return { error: partnerFacingError("Could not save the contact.", error?.message) };
    }
    contactId = created.id as string;
  }

  let companyId: string | undefined;

  if (website) {
    const { data: byWebsite } = await supabase
      .from("companies")
      .select("id, website")
      .ilike("website", `%${website}%`)
      .limit(5);
    const match = (byWebsite ?? []).find((row) => {
      const existingSite = normalizeWebsite((row.website as string) || "");
      return (
        existingSite && existingSite.toLowerCase() === website.toLowerCase()
      );
    });
    if (match) companyId = match.id as string;
  }

  if (!companyId) {
    const { data: byName } = await supabase
      .from("companies")
      .select("id, name")
      .ilike("name", companyName)
      .limit(1)
      .maybeSingle();
    if (byName?.id) companyId = byName.id as string;
  }

  if (!companyId) {
    companyId = existing.company_id as string;
  }

  const companyFields = {
    name: companyName,
    website: website || null,
    created_by_workspace_id: null,
  };

  if (companyId) {
    const { error } = await supabase
      .from("companies")
      .update(companyFields)
      .eq("id", companyId);
    if (error) return { error: partnerFacingError("Could not update the opportunity.", error.message) };
  } else {
    const { data: created, error } = await supabase
      .from("companies")
      .insert(companyFields)
      .select("id")
      .single();
    if (error || !created) {
      return { error: partnerFacingError("Could not save the company.", error?.message) };
    }
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
      title_function: contactTitle || null,
      is_primary: true,
    });
    if (error) return { error: partnerFacingError("Could not update the opportunity.", error.message) };
  } else if (contactTitle) {
    await supabase
      .from("company_contacts")
      .update({ title_function: contactTitle })
      .eq("id", existingLink.id as string);
  }

  // Re-check status to avoid races with admin transitions.
  const { data: fresh, error: freshError } = await supabase
    .from("partner_opportunities")
    .select("id, status")
    .eq("id", opportunityId)
    .eq("partner_profile_id", profile.id)
    .maybeSingle();

  if (freshError) return { error: partnerFacingError("Could not update the opportunity.", freshError.message) };
  if (!fresh || !isOpportunityEditable(fresh.status as string)) {
    return {
      error:
        "This opportunity can no longer be edited once it is in progress or later.",
    };
  }

  const patch = {
    company_id: companyId,
    primary_contact_id: contactId,
    product_interest: productInterestStored,
    estimated_seats: estimatedSeats,
    estimated_value: estimatedValue,
    notes,
    permission_to_contact: true,
    attachment_document_id: attachmentDocumentId,
  };

  const { error: oppError } = await supabase
    .from("partner_opportunities")
    .update(patch)
    .eq("id", opportunityId)
    .eq("partner_profile_id", profile.id);

  if (oppError) {
    return { error: partnerFacingError("Could not update the opportunity.", oppError.message) };
  }

  if ((fresh.status as string).toLowerCase() === "accepted") {
    const application = parseApplicationData(profile.application_data);
    const partnerCompanyName =
      context?.company?.name?.trim() ||
      application.legal_name.trim() ||
      "Partner";

    await createPartnerAdminNotification({
      kind: "opportunity_updated",
      title: "Accepted opportunity updated",
      body: `${companyName} — edited by ${partnerCompanyName}`,
      href: `/super-admin/partner-center/opportunities/${opportunityId}`,
      entityType: "partner_opportunity",
      entityId: opportunityId,
    });

    const admin = createAdminClient();
    if (admin) {
      await writePartnerAdminAudit(admin, {
        actorUserId: user.id,
        entityType: "partner_opportunity",
        entityId: opportunityId,
        action: "opportunity_updated",
        previousValue: {
          company_id: existing.company_id,
          primary_contact_id: existing.primary_contact_id,
        },
        newValue: {
          company_id: companyId,
          primary_contact_id: contactId,
          contact_email: contactEmail,
        },
        reason: "Partner edited accepted opportunity",
      });
    }
  }

  return { opportunityId };
}
