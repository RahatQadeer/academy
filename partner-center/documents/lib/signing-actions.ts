"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignablePdf } from "@/base/lib/signing/placement";
import { signFromForm, signedFileName } from "@/base/lib/signing/stamp";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { parseDocumentKind } from "@/partner-center/documents/lib/meta";
import { copyPartnerDocumentMeta } from "@/partner-center/documents/lib/meta-store";
import { requirePartnerAppAccess } from "@/partner-center/lib/access";
import { createAdminClient } from "@/partner-center/lib/supabase-admin";
import { partnerFacingError } from "@/partner-center/lib/user-facing-error";

const DOCUMENTS_PATH = "/partner-center/documents";
const BUCKET = "documents";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|docx?|png|jpe?g|gif|webp)$/i;

export type PartnerSigningResult = { error: string } | void;

type Writer =
  | NonNullable<ReturnType<typeof createAdminClient>>
  | Awaited<ReturnType<typeof createClient>>;

function canMutate(accessLevel: string | null | undefined): boolean {
  return accessLevel !== "read_only";
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function titleFromUploadedName(fileNameOrPath: string, fallback: string): string {
  const raw = fileNameOrPath.split("/").pop()?.split("?")[0]?.trim() || "";
  const withoutTs = raw.replace(/^\d+-/, "").trim();
  if (!withoutTs) return fallback;
  try {
    return decodeURIComponent(withoutTs);
  } catch {
    return withoutTs;
  }
}

async function assertPartnerDocument(
  reader: Writer,
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

function revalidateAfterSign(documentId: string, nextId: string) {
  revalidatePath(DOCUMENTS_PATH);
  revalidatePath(`${DOCUMENTS_PATH}/${documentId}`);
  revalidatePath(`${DOCUMENTS_PATH}/${nextId}`);
  revalidatePath("/partner-center/onboarding/checklist");
  revalidatePath("/partner-center", "layout");
}

/**
 * Shared filing for a signed partner document: new completed version, archive
 * the original, copy labels/meta, and stamp agreement_signed_at when needed.
 */
export async function filePartnerSignedVersion(input: {
  writer: Writer;
  userId: string;
  profileId: string;
  applicationData: unknown;
  documentId: string;
  path: string;
  /** When set, used as the new row title; otherwise keep the previous title. */
  title?: string | null;
  externalSignatureRef?: string | null;
  signer?: {
    name: string | null;
    method: "typed" | "uploaded";
    note: string | null;
  };
  auditAction?: string;
}): Promise<{ documentId: string } | { error: string }> {
  const { data: current } = await input.writer
    .from("documents")
    .select(
      "version, title, visibility, status, superseded_by_document_id, effective_date",
    )
    .eq("id", input.documentId)
    .maybeSingle();

  if (!current) return { error: "That document could not be found." };
  if (
    (current.status as string) === "archived" ||
    current.superseded_by_document_id
  ) {
    return { error: "This document was already updated." };
  }

  const signedDate = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const nextTitle =
    (input.title?.trim() ||
      (current.title as string) ||
      titleFromUploadedName(input.path, "Signed copy")).trim();

  const version = ((current.version as number) ?? 1) + 1;

  const insertRow: Record<string, unknown> = {
    title: nextTitle,
    file_url: input.path,
    context_type: "partner_profile",
    context_id: input.profileId,
    visibility: (current.visibility as string) || "internal",
    status: "completed",
    version,
    signed_date: signedDate,
    effective_date: (current.effective_date as string | null) ?? signedDate,
    uploaded_by_user_id: input.userId,
  };

  if (input.signer) {
    insertRow.signature_state = "signed";
    insertRow.signature_actioned_at = now;
    insertRow.signature_method = input.signer.method;
    insertRow.signature_signed_name = input.signer.name;
    insertRow.signature_note = input.signer.note;
  }

  let { data: next, error } = await input.writer
    .from("documents")
    .insert(insertRow)
    .select("id")
    .single();

  // Shared DB may not have Whitby signature_* columns yet — retry without them.
  if (
    error &&
    input.signer &&
    /signature_/i.test(error.message || "")
  ) {
    const basic = { ...insertRow };
    delete basic.signature_state;
    delete basic.signature_actioned_at;
    delete basic.signature_method;
    delete basic.signature_signed_name;
    delete basic.signature_note;
    const retry = await input.writer
      .from("documents")
      .insert(basic)
      .select("id")
      .single();
    next = retry.data;
    error = retry.error;
  }

  if (error || !next) {
    await input.writer.storage.from(BUCKET).remove([input.path]);
    return {
      error: partnerFacingError("Could not save the signed copy.", error?.message),
    };
  }

  const nextId = next.id as string;

  const { data: claimed, error: claimError } = await input.writer
    .from("documents")
    .update({
      status: "archived",
      superseded_by_document_id: nextId,
      updated_at: now,
    })
    .eq("id", input.documentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", input.profileId)
    .is("superseded_by_document_id", null)
    .neq("status", "archived")
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    await input.writer.from("documents").delete().eq("id", nextId);
    await input.writer.storage.from(BUCKET).remove([input.path]);
    return { error: "This document was already updated." };
  }

  const { data: oldLabels } = await input.writer
    .from("document_labels")
    .select("label_text")
    .eq("document_id", input.documentId);

  if (oldLabels && oldLabels.length > 0) {
    await input.writer.from("document_labels").insert(
      oldLabels.map((row) => ({
        document_id: nextId,
        label_text: row.label_text as string,
        created_by_user_id: input.userId,
      })),
    );
  }

  await copyPartnerDocumentMeta({
    writer: input.writer,
    fromDocumentId: input.documentId,
    toDocumentId: nextId,
    partnerProfileId: input.profileId,
    overrides: {
      neededAction: null,
      externalSignatureRef: input.externalSignatureRef ?? null,
    },
  });

  const { data: meta } = await input.writer
    .from("partner_document_meta")
    .select("document_kind")
    .eq("document_id", nextId)
    .maybeSingle();
  const documentKind = parseDocumentKind(meta?.document_kind);

  if (documentKind === "agreement") {
    const priorData =
      input.applicationData &&
      typeof input.applicationData === "object" &&
      !Array.isArray(input.applicationData)
        ? { ...(input.applicationData as Record<string, unknown>) }
        : {};
    if (
      typeof priorData.agreement_signed_at !== "string" ||
      !priorData.agreement_signed_at
    ) {
      priorData.agreement_signed_at = now;
    }
    await input.writer
      .from("partner_profiles")
      .update({
        agreement_status: "signed",
        agreement_document_id: nextId,
        application_data: priorData,
        updated_at: now,
      })
      .eq("id", input.profileId);
  }

  await input.writer.from("audit_log").insert({
    actor_user_id: input.userId,
    entity_type: "document",
    entity_id: nextId,
    action: input.auditAction ?? "document_signed",
    reason: input.externalSignatureRef || input.signer?.note || null,
    previous_value: { document_id: input.documentId },
    new_value: {
      document_id: nextId,
      signed_date: signedDate,
      method: input.signer?.method ?? null,
    },
  });

  revalidateAfterSign(input.documentId, nextId);
  return { documentId: nextId };
}

async function requireSigningContext(documentId: string): Promise<
  | {
      ok: true;
      user: { id: string };
      profile: {
        id: string;
        application_data: unknown;
      };
      supabase: Awaited<ReturnType<typeof createClient>>;
      writer: Writer;
      doc: {
        id: string;
        title: string | null;
        file_url: string | null;
      };
    }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Connect Supabase to update documents." };
  }
  if (!documentId) return { ok: false, error: "Missing document." };

  const { user, context } = await requirePartnerAppAccess();
  const profile = context?.profile;
  if (!profile) return { ok: false, error: "No partner profile is available." };
  if (!canMutate(context?.teamMember?.access_level)) {
    return { ok: false, error: "You do not have permission to update documents." };
  }

  const supabase = await createClient();
  const writer = createAdminClient() ?? supabase;
  const doc = await assertPartnerDocument(writer, profile.id, documentId);
  if (!doc) return { ok: false, error: "That document could not be found." };

  return {
    ok: true,
    user: { id: user.id },
    profile: { id: profile.id, application_data: profile.application_data },
    supabase,
    writer,
    doc: {
      id: doc.id as string,
      title: (doc.title as string | null) ?? null,
      file_url: (doc.file_url as string | null) ?? null,
    },
  };
}

/**
 * Sign on screen — typed name stamped onto the PDF via shared base stamp pipeline.
 * Returns `{ error }` so SignWorkspace can keep placements; redirects on success.
 */
export async function signPartnerDocumentOnScreen(
  formData: FormData,
): Promise<PartnerSigningResult> {
  const documentId = text(formData, "documentId");
  const found = await requireSigningContext(documentId);
  if (!found.ok) return { error: found.error };

  const { user, profile, supabase, writer, doc } = found;
  const fileUrl = String(doc.file_url ?? "").trim();
  if (!isSignablePdf(fileUrl)) {
    return {
      error: "Only a PDF can be signed on screen. Use “Sign on paper” instead.",
    };
  }

  const { data: original, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(fileUrl);
  if (downloadError || !original) {
    return { error: "The document could not be opened. Please try again." };
  }

  const stamped = await signFromForm(
    formData,
    new Uint8Array(await original.arrayBuffer()),
  );
  if ("error" in stamped) return { error: stamped.error };

  const path = `partner/${profile.id}/documents/${Date.now()}-${signedFileName(
    doc.title || "document",
    "pdf",
  )}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, stamped.bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return {
      error: partnerFacingError(
        "The signed copy could not be saved. Please try again.",
        uploadError.message,
      ),
    };
  }

  const note = text(formData, "note") || null;
  const filed = await filePartnerSignedVersion({
    writer,
    userId: user.id,
    profileId: profile.id,
    applicationData: profile.application_data,
    documentId,
    path,
    title: doc.title,
    externalSignatureRef: `typed:${stamped.name}`,
    signer: { name: stamped.name, method: "typed", note },
    auditAction: "document_signed_on_screen",
  });
  if ("error" in filed) return { error: filed.error };

  redirect(`${DOCUMENTS_PATH}/${filed.documentId}`);
}

/**
 * Sign on paper — upload the scanned/signed file back through SignWorkspace.
 */
export async function uploadPartnerSignedCopy(
  formData: FormData,
): Promise<PartnerSigningResult> {
  const documentId = text(formData, "documentId");
  const found = await requireSigningContext(documentId);
  if (!found.ok) return { error: found.error };

  const { user, profile, supabase, writer, doc } = found;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the signed copy to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Files must be 25 MB or smaller." };
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return { error: "Upload the signed copy as a PDF, a photo (PNG or JPG), or a Word file." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const path = `partner/${profile.id}/documents/${Date.now()}-${signedFileName(
    doc.title || "document",
    extension,
  )}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) {
    return {
      error: partnerFacingError("Upload failed. Please try again.", uploadError.message),
    };
  }

  const note = text(formData, "note") || null;
  const filed = await filePartnerSignedVersion({
    writer,
    userId: user.id,
    profileId: profile.id,
    applicationData: profile.application_data,
    documentId,
    path,
    title: doc.title,
    externalSignatureRef: note,
    signer: { name: null, method: "uploaded", note },
    auditAction: "signed_copy_uploaded",
  });
  if ("error" in filed) return { error: filed.error };

  redirect(`${DOCUMENTS_PATH}/${filed.documentId}`);
}

/** Used by the legacy prepare/submit path so both share one filing helper. */
export async function filePartnerSignedCopyFromPath(input: {
  writer: Writer;
  userId: string;
  profileId: string;
  applicationData: unknown;
  documentId: string;
  path: string;
  externalSignatureRef?: string | null;
}): Promise<{ documentId: string } | { error: string }> {
  const { data: current } = await input.writer
    .from("documents")
    .select("title")
    .eq("id", input.documentId)
    .maybeSingle();

  return filePartnerSignedVersion({
    writer: input.writer,
    userId: input.userId,
    profileId: input.profileId,
    applicationData: input.applicationData,
    documentId: input.documentId,
    path: input.path,
    title: titleFromUploadedName(
      input.path,
      (current?.title as string) || "Signed copy",
    ),
    externalSignatureRef: input.externalSignatureRef ?? null,
    signer: { name: null, method: "uploaded", note: null },
    auditAction: "signed_copy_uploaded",
  });
}
