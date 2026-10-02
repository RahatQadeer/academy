import { createClient } from "@/base/lib/supabase/server";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { isAgreementSigned } from "@/partner-center/lib/review-state";
import { upsertPartnerDocumentMeta } from "@/partner-center/documents/lib/meta-store";
import type { PartnerContext } from "@/partner-center/types/partner";

/**
 * SRS §17.13.4 / §17.11.4 / §14.8 — the accepted agreement must live in the
 * partner Documents library, not only as a status flag on partner_profiles.
 *
 * file_url is an in-app path (no PDF yet from external sign). Detail/download
 * treat paths starting with `/` as app routes, not Storage objects.
 */
export async function ensureAgreementDocument(input: {
  context: PartnerContext;
  userId: string;
}): Promise<string | null> {
  if (!input.context.profile) return null;
  // Local binding so nested helpers see a non-null profile (TS doesn't keep
  // narrowing inside closures over a possibly-null const).
  const profile = input.context.profile;
  if (!isAgreementSigned(profile.agreement_status)) return null;

  const supabase = await createClient();
  const writer = createAdminClient() ?? supabase;

  async function attachMeta(documentId: string) {
    await upsertPartnerDocumentMeta(writer, {
      documentId,
      partnerProfileId: profile.id,
      program: null,
      documentKind: "agreement",
      neededAction: null,
    });
  }

  function signedIsoFromProfile(): string {
    const data = profile.application_data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const signed = (data as { agreement_signed_at?: unknown })
        .agreement_signed_at;
      if (typeof signed === "string" && signed.trim()) return signed.trim();
    }
    return new Date().toISOString();
  }

  async function ensureAgreementDates(documentId: string) {
    const signedAt = signedIsoFromProfile();
    const signedDate = signedAt.slice(0, 10);
    const { data: existing } = await writer
      .from("documents")
      .select("effective_date, signed_date")
      .eq("id", documentId)
      .maybeSingle();
    if (!existing) return;
    if (existing.effective_date && existing.signed_date) return;
    await writer
      .from("documents")
      .update({
        effective_date: existing.effective_date ?? signedDate,
        signed_date: existing.signed_date ?? signedDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);
  }

  if (profile.agreement_document_id) {
    await attachMeta(profile.agreement_document_id);
    await ensureAgreementDates(profile.agreement_document_id);
    return profile.agreement_document_id;
  }

  // Reuse an existing synthetic agreement row if one already exists (avoids
  // duplicate Partner Agreement rows when agreement_document_id was null).
  const { data: existing } = await writer
    .from("documents")
    .select("id")
    .eq("context_type", "partner_profile")
    .eq("context_id", profile.id)
    .eq("file_url", "/partner-center/onboarding/agreement/view")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await writer
      .from("partner_profiles")
      .update({
        agreement_document_id: existing.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    profile.agreement_document_id = existing.id as string;
    await attachMeta(existing.id as string);
    await ensureAgreementDates(existing.id as string);
    return existing.id as string;
  }

  const signedAt = signedIsoFromProfile();
  const signedDate = signedAt.slice(0, 10);
  const title = "Partner Agreement";

  const { data: document, error } = await writer
    .from("documents")
    .insert({
      title,
      file_url: "/partner-center/onboarding/agreement/view",
      context_type: "partner_profile",
      context_id: profile.id,
      visibility: "internal",
      status: "current",
      version: 1,
      effective_date: signedDate,
      signed_date: signedDate,
      uploaded_by_user_id: input.userId,
      shared_by_user_id: input.userId,
    })
    .select("id")
    .single();

  if (error || !document) return null;

  await attachMeta(document.id as string);

  await writer.from("document_labels").insert({
    document_id: document.id,
    label_text: "Agreement",
    created_by_user_id: input.userId,
  });

  const year = signedDate.slice(0, 4);
  if (/^\d{4}$/.test(year)) {
    await writer.from("document_labels").insert({
      document_id: document.id,
      label_text: year,
      created_by_user_id: input.userId,
    });
  }

  await writer
    .from("partner_profiles")
    .update({
      agreement_document_id: document.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  profile.agreement_document_id = document.id;
  return document.id as string;
}
