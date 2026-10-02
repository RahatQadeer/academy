"use server";

import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import {
  parseDocumentKind,
  parseDocumentProgram,
} from "@/partner-center/documents/lib/meta";
import {
  copyPartnerDocumentMeta,
  upsertPartnerDocumentMeta,
} from "@/partner-center/documents/lib/meta-store";
import { filePartnerSignedCopyFromPath } from "@/partner-center/documents/lib/signing-actions";

const DOCUMENTS_PATH = "/partner-center/documents";
const BUCKET = "documents";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|docx?|png|jpe?g|gif|webp)$/i;

export async function downloadPartnerDocumentForm(formData: FormData) {
  const documentId = formData.get("documentId");
  if (typeof documentId !== "string" || !documentId) {
    redirect(DOCUMENTS_PATH);
  }
  await downloadPartnerDocument(documentId);
}

export type DocumentActionResult = {
  error?: string;
  ok?: boolean;
  documentId?: string;
};

function canMutate(accessLevel: string | null | undefined): boolean {
  return accessLevel !== "read_only";
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Display title from an uploaded file name or storage object path (strip timestamp prefix). */
function titleFromUploadedName(
  fileNameOrPath: string,
  fallback: string,
): string {
  const raw =
    fileNameOrPath.split("/").pop()?.split("?")[0]?.trim() || "";
  const withoutTs = raw.replace(/^\d+-/, "").trim();
  if (!withoutTs) return fallback;
  try {
    return decodeURIComponent(withoutTs);
  } catch {
    return withoutTs;
  }
}

async function assertPartnerDocument(
  reader: NonNullable<ReturnType<typeof createAdminClient>> | Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  documentId: string,
) {
  const { data } = await reader
    .from("documents")
    .select("id, title, uploaded_by_user_id, file_url, visibility")
    .eq("id", documentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", profileId)
    .maybeSingle();
  if (!data || (data.visibility as string) === "restricted") return null;
  return data;
}

/** Safe Content-Disposition filename from storage path + document title. */
function downloadFileName(
  fileUrl: string,
  title: string | null | undefined,
): string {
  const fromPath = fileUrl.split("/").pop()?.split("?")[0]?.trim() || "";
  const extMatch = fromPath.match(/(\.[a-z0-9]{1,8})$/i);
  const ext = extMatch?.[1] ?? "";
  const base =
    (title ?? "")
      .trim()
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 80) || fromPath.replace(/^\d+-/, "") || "document";
  if (ext && !base.toLowerCase().endsWith(ext.toLowerCase())) {
    return `${base}${ext}`;
  }
  return base || "document";
}

export async function uploadPartnerDocument(
  formData: FormData,
): Promise<DocumentActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to upload documents." };
  }

  const { user, context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) return { error: "No partner profile is available." };
  if (!canMutate(context?.teamMember?.access_level)) {
    return { error: "You do not have permission to upload documents." };
  }

  const file = formData.get("file");
  const title = text(formData, "title");
  const note = text(formData, "note");
  const labelsRaw = text(formData, "labels");
  const labels = labelsRaw
    ? labelsRaw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  const program = parseDocumentProgram(text(formData, "program") || null);
  const documentKind = parseDocumentKind(text(formData, "documentKind") || "other");
  const isTax = documentKind === "tax";

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Files must be 25 MB or smaller." };
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return { error: "Use a PDF, DOCX, or image file." };
  }

  const supabase = await createClient();
  const writer = createAdminClient() ?? supabase;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `partner/${profile.id}/documents/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return { error: partnerFacingError("Could not upload the file.", uploadError.message) };
  }

  const { data: document, error } = await writer
    .from("documents")
    .insert({
      title: title || file.name,
      file_url: path,
      context_type: "partner_profile",
      context_id: profile.id,
      // §17.12.12 — tax certs are restricted, not ordinary library docs.
      visibility: isTax ? "restricted" : "internal",
      status: "current",
      version: 1,
      uploaded_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !document) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: partnerFacingError("Could not save the document.", error?.message) };
  }

  await upsertPartnerDocumentMeta(writer, {
    documentId: document.id as string,
    partnerProfileId: profile.id,
    program,
    documentKind,
    neededAction: null,
  });

  if (labels.length > 0 && !isTax) {
    await writer.from("document_labels").insert(
      labels.map((label_text) => ({
        document_id: document.id,
        label_text,
        created_by_user_id: user.id,
      })),
    );
  }

  if (note) {
    await writer.from("audit_log").insert({
      actor_user_id: user.id,
      entity_type: "document",
      entity_id: document.id,
      action: "upload",
      reason: note,
      new_value: { note, title: title || file.name, documentKind, program },
    });
  }

  revalidatePath(DOCUMENTS_PATH);
  if (isTax) {
    revalidatePath("/partner-center/tax");
  }
  return { ok: true };
}

export async function addDocumentLabel(input: {
  documentId: string;
  label: string;
}): Promise<DocumentActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to add labels." };
  }

  const { user, context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) return { error: "No partner profile is available." };
  if (!canMutate(context?.teamMember?.access_level)) {
    return { error: "You do not have permission to edit labels." };
  }

  const label = input.label.trim();
  if (!label) return { error: "Enter a label." };
  if (label.length > 40) return { error: "Labels must be 40 characters or fewer." };

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;
  const doc = await assertPartnerDocument(reader, profile.id, input.documentId);
  if (!doc) return { error: "That document could not be found." };

  const { data: existing } = await reader
    .from("document_labels")
    .select("id")
    .eq("document_id", input.documentId)
    .eq("label_text", label)
    .maybeSingle();
  if (existing) return { ok: true };

  const { error } = await supabase.from("document_labels").insert({
    document_id: input.documentId,
    label_text: label,
    created_by_user_id: user.id,
  });

  if (error) return { error: partnerFacingError("Could not add the label.", error.message) };

  revalidatePath(DOCUMENTS_PATH);
  revalidatePath(`${DOCUMENTS_PATH}/${input.documentId}`);
  return { ok: true };
}

export async function renameDocumentLabel(input: {
  from: string;
  to: string;
}): Promise<DocumentActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to rename labels." };
  }

  const { user, context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) return { error: "No partner profile is available." };
  if (!canMutate(context?.teamMember?.access_level)) {
    return { error: "You do not have permission to rename labels." };
  }

  const from = input.from.trim();
  const to = input.to.trim();
  if (!from || !to) return { error: "Enter the new label name." };
  if (to.length > 40) return { error: "Labels must be 40 characters or fewer." };
  if (from === to) return { ok: true };

  const supabase = await createClient();
  // Service role after access check — user-scoped UPDATE is blocked by
  // document_labels RLS WITH CHECK (created_by_user_id = auth.uid()) when
  // another teammate (or seeded flow) created the row; Supabase returns no error.
  const writer = createAdminClient() ?? supabase;

  const { data: docs } = await writer
    .from("documents")
    .select("id")
    .eq("context_type", "partner_profile")
    .eq("context_id", profile.id);
  const docIds = (docs ?? []).map((row) => row.id as string);
  if (docIds.length === 0) return { ok: true };

  const { data: labelRows } = await writer
    .from("document_labels")
    .select("id")
    .in("document_id", docIds)
    .eq("label_text", from);

  const labelIds = (labelRows ?? []).map((row) => row.id as string);
  if (labelIds.length === 0) {
    return { error: `No documents use the label “${from}”.` };
  }

  const { data: updated, error } = await writer
    .from("document_labels")
    .update({ label_text: to })
    .in("id", labelIds)
    .select("id");
  if (error) {
    return { error: partnerFacingError("Could not rename the label.", error.message) };
  }
  if (!updated?.length) {
    return { error: "Could not rename the label. Try again." };
  }

  await writer.from("audit_log").insert({
    actor_user_id: user.id,
    entity_type: "document_label",
    entity_id: profile.id,
    action: "rename_label",
    previous_value: { label: from },
    new_value: { label: to },
  });

  revalidatePath(DOCUMENTS_PATH);
  return { ok: true };
}

export async function downloadPartnerDocument(
  documentId: string,
): Promise<never> {
  const { context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile || !isSupabaseConfigured()) {
    redirect(DOCUMENTS_PATH);
  }

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;
  const doc = await assertPartnerDocument(reader, profile.id, documentId);
  const fileUrl = (doc?.file_url as string | null)?.trim();
  if (!fileUrl) {
    redirect(`${DOCUMENTS_PATH}/${documentId}`);
  }

  // In-app agreement copy (no Storage object) — SRS §17.13.4 accepted record.
  if (fileUrl.startsWith("/")) {
    redirect(fileUrl);
  }

  // External link (e.g. staff Dropbox) — no Content-Disposition control.
  if (/^https?:\/\//i.test(fileUrl)) {
    redirect(fileUrl);
  }

  // Force save-to-disk instead of inline preview (Supabase `?download=`).
  const filename = downloadFileName(
    fileUrl,
    (doc?.title as string | null) ?? null,
  );
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fileUrl, 60, { download: filename });

  if (error || !data?.signedUrl) {
    // Admin client can mint when user RLS cannot read storage.objects.
    const admin = createAdminClient();
    if (admin) {
      const adminSigned = await admin.storage
        .from(BUCKET)
        .createSignedUrl(fileUrl, 60, { download: filename });
      if (adminSigned.data?.signedUrl) {
        redirect(adminSigned.data.signedUrl);
      }
    }
    redirect(`${DOCUMENTS_PATH}/${documentId}`);
  }
  redirect(data.signedUrl);
}

export async function replaceOwnDocument(
  formData: FormData,
): Promise<DocumentActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to update documents." };
  }

  const { user, context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) return { error: "No partner profile is available." };
  if (!canMutate(context?.teamMember?.access_level)) {
    return { error: "You do not have permission to update documents." };
  }

  const documentId = text(formData, "documentId");
  const file = formData.get("file");
  if (!documentId) return { error: "Missing document." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Files must be 25 MB or smaller." };
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return { error: "Use a PDF, DOCX, or image file." };
  }

  const supabase = await createClient();
  const reader = createAdminClient() ?? supabase;
  const doc = await assertPartnerDocument(reader, profile.id, documentId);
  if (!doc) return { error: "That document could not be found." };
  if ((doc.uploaded_by_user_id as string) !== user.id) {
    return {
      error: "Ask Private Attaché to update this file.",
    };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `partner/${profile.id}/documents/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (uploadError) {
    return { error: partnerFacingError("Could not upload the file.", uploadError.message) };
  }

  const { data: current } = await reader
    .from("documents")
    .select("version, title")
    .eq("id", documentId)
    .maybeSingle();

  const version = ((current?.version as number) ?? 1) + 1;
  const nextTitle = titleFromUploadedName(file.name, "Document");

  await supabase
    .from("documents")
    .update({
      status: "archived",
      superseded_by_document_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  const { data: next, error } = await supabase
    .from("documents")
    .insert({
      title: nextTitle,
      file_url: path,
      context_type: "partner_profile",
      context_id: profile.id,
      visibility: "internal",
      status: "current",
      version,
      uploaded_by_user_id: user.id,
      superseded_by_document_id: null,
    })
    .select("id")
    .single();

  if (error || !next) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: partnerFacingError("Could not save the new version.", error?.message) };
  }

  const nextId = next.id as string;

  await supabase
    .from("documents")
    .update({ superseded_by_document_id: nextId })
    .eq("id", documentId);

  const { data: oldLabels } = await reader
    .from("document_labels")
    .select("label_text")
    .eq("document_id", documentId);

  if (oldLabels && oldLabels.length > 0) {
    await supabase.from("document_labels").insert(
      oldLabels.map((row) => ({
        document_id: nextId,
        label_text: row.label_text as string,
        created_by_user_id: user.id,
      })),
    );
  }

  const writer = createAdminClient() ?? supabase;
  await copyPartnerDocumentMeta({
    writer,
    fromDocumentId: documentId,
    toDocumentId: nextId,
    partnerProfileId: profile.id,
  });

  const { data: meta } = await writer
    .from("partner_document_meta")
    .select("document_kind")
    .eq("document_id", nextId)
    .maybeSingle();
  if (parseDocumentKind(meta?.document_kind) === "agreement") {
    await writer
      .from("partner_profiles")
      .update({
        agreement_document_id: nextId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }

  revalidatePath(DOCUMENTS_PATH);
  revalidatePath(`${DOCUMENTS_PATH}/${documentId}`);
  revalidatePath(`${DOCUMENTS_PATH}/${nextId}`);
  return { ok: true, documentId: nextId };
}

/**
 * Returns a storage path the partner may upload the signed file to (browser →
 * Supabase). Keeps the signed-copy server action under Vercel/Next body limits.
 */
export async function prepareSignedCopyUpload(
  formData: FormData,
): Promise<{ error?: string; path?: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to update documents." };
  }

  const { context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) return { error: "No partner profile is available." };
  if (!canMutate(context?.teamMember?.access_level)) {
    return { error: "You do not have permission to update documents." };
  }

  const documentId = text(formData, "documentId");
  const fileName = text(formData, "fileName");
  if (!documentId) return { error: "Missing document." };
  if (!fileName) return { error: "Choose the signed file to upload." };
  if (!ALLOWED_EXT.test(fileName)) {
    return { error: "Use a PDF, DOCX, or image file." };
  }

  const supabase = await createClient();
  const writer = createAdminClient() ?? supabase;
  const doc = await assertPartnerDocument(writer, profile.id, documentId);
  if (!doc) return { error: "That document could not be found." };

  const { data: current } = await writer
    .from("documents")
    .select("status, superseded_by_document_id")
    .eq("id", documentId)
    .maybeSingle();
  if (!current) return { error: "That document could not be found." };
  if (
    (current.status as string) === "archived" ||
    current.superseded_by_document_id
  ) {
    return { error: "This document was already updated." };
  }

  const safeName = fileName.replace(/[^\w.\-]+/g, "_");
  return {
    path: `partner/${profile.id}/documents/${Date.now()}-${safeName}`,
  };
}

/**
 * Partner uploads the final signed copy (paper / external path).
 * Prefer `storagePath` from a prior browser upload (see prepareSignedCopyUpload).
 * `file` is still accepted for small uploads / local fallback.
 */
export async function submitSignedDocumentCopy(
  formData: FormData,
): Promise<DocumentActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to update documents." };
  }

  const { user, context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) return { error: "No partner profile is available." };
  if (!canMutate(context?.teamMember?.access_level)) {
    return { error: "You do not have permission to update documents." };
  }

  const documentId = text(formData, "documentId");
  const signatureRef = text(formData, "externalSignatureRef");
  const storagePath = text(formData, "storagePath");
  const file = formData.get("file");
  if (!documentId) return { error: "Missing document." };

  const prefix = `partner/${profile.id}/documents/`;
  let path: string;
  let uploadedViaAction = false;

  if (storagePath) {
    if (!storagePath.startsWith(prefix) || storagePath.includes("..")) {
      return { error: "Invalid upload path." };
    }
    if (!ALLOWED_EXT.test(storagePath)) {
      return { error: "Use a PDF, DOCX, or image file." };
    }
    path = storagePath;
  } else if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return { error: "Files must be 25 MB or smaller." };
    }
    if (!ALLOWED_EXT.test(file.name)) {
      return { error: "Use a PDF, DOCX, or image file." };
    }
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    path = `${prefix}${Date.now()}-${safeName}`;
    uploadedViaAction = true;
  } else {
    return { error: "Choose the signed file to upload." };
  }

  const supabase = await createClient();
  const writer = createAdminClient() ?? supabase;
  const doc = await assertPartnerDocument(writer, profile.id, documentId);
  if (!doc) return { error: "That document could not be found." };

  const { data: current } = await writer
    .from("documents")
    .select("status, superseded_by_document_id")
    .eq("id", documentId)
    .maybeSingle();

  if (!current) return { error: "That document could not be found." };
  if (
    (current.status as string) === "archived" ||
    current.superseded_by_document_id
  ) {
    return { error: "This document was already updated." };
  }

  if (uploadedViaAction && file instanceof File) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
    if (uploadError) {
      return { error: partnerFacingError("Could not upload the file.", uploadError.message) };
    }
  } else {
    const { error: missingError } = await writer.storage
      .from(BUCKET)
      .createSignedUrl(path, 60);
    if (missingError) {
      return { error: "Upload did not finish. Try again." };
    }
  }

  const filed = await filePartnerSignedCopyFromPath({
    writer,
    userId: user.id,
    profileId: profile.id,
    applicationData: profile.application_data,
    documentId,
    path,
    externalSignatureRef: signatureRef || null,
  });
  if ("error" in filed) return { error: filed.error };
  return { ok: true, documentId: filed.documentId };
}
