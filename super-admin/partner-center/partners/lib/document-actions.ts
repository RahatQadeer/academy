"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  actionHrefFor,
  resolveNeededAction,
} from "@/partner-center/documents/lib/format";
import {
  parseDocumentKind,
  parseDocumentProgram,
  parseNeededActionMeta,
  type PartnerDocumentKind,
} from "@/partner-center/documents/lib/meta";
import {
  copyPartnerDocumentMeta,
  upsertPartnerDocumentMeta,
} from "@/partner-center/documents/lib/meta-store";
import type {
  DocumentNeededAction,
  DocumentStatus,
} from "@/partner-center/documents/types";
import { notifyPartnerDocumentActionNeeded } from "@/partner-center/lib/notifications/create-partner-notification";
import { adminWriter } from "@/super-admin/partner-center/lib/admin-writer";
import { writePartnerAdminAudit } from "@/super-admin/partner-center/lib/admin-audit";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { parseAdminDocumentStatus } from "@/super-admin/partner-center/partners/lib/load-partner-documents";

const BUCKET = "documents";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|docx?|png|jpe?g|gif|webp)$/i;
const PARTNER_DOCS = "/partner-center/documents";

export type AdminDocumentActionResult = {
  error?: string;
  ok?: boolean;
  documentId?: string;
};

function revalidatePartnerDocs(partnerProfileId: string, documentId?: string) {
  revalidatePath(PC_ADMIN.partner(partnerProfileId));
  revalidatePath(PC_ADMIN.partnerDocuments(partnerProfileId));
  revalidatePath(PARTNER_DOCS);
  revalidatePath(`${PARTNER_DOCS}/layout`);
  if (documentId) {
    revalidatePath(`${PARTNER_DOCS}/${documentId}`);
    revalidatePath(PC_ADMIN.partnerDocument(partnerProfileId, documentId));
  }
  revalidatePath("/partner-center/onboarding/checklist");
  revalidatePath("/partner-center", "layout");
}

function storagePath(partnerProfileId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-]+/g, "_");
  return `partner/${partnerProfileId}/documents/${Date.now()}-${safeName}`;
}

function emptyDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function assertPartnerLibraryDoc(
  admin: SupabaseClient,
  partnerProfileId: string,
  documentId: string,
) {
  const { data } = await admin
    .from("documents")
    .select(
      "id, title, status, version, visibility, file_url, superseded_by_document_id, effective_date, signed_date",
    )
    .eq("id", documentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", partnerProfileId)
    .neq("visibility", "restricted")
    .maybeSingle();
  return data;
}

/** Refuse if already archived or superseded (§ race guard). */
function raceGuardError(row: {
  status: string | null;
  superseded_by_document_id: string | null;
}): string | null {
  if ((row.status as string) === "archived") {
    return "This document was already updated.";
  }
  if (row.superseded_by_document_id) {
    return "This document was already updated.";
  }
  return null;
}

async function syncAgreementProfile(input: {
  admin: SupabaseClient;
  partnerProfileId: string;
  documentId: string;
  signedDate: string;
}) {
  const { data: profile } = await input.admin
    .from("partner_profiles")
    .select("id, application_data, agreement_status")
    .eq("id", input.partnerProfileId)
    .maybeSingle();
  if (!profile) return;

  const prior =
    profile.application_data &&
    typeof profile.application_data === "object" &&
    !Array.isArray(profile.application_data)
      ? { ...(profile.application_data as Record<string, unknown>) }
      : {};

  if (typeof prior.agreement_signed_at !== "string" || !prior.agreement_signed_at) {
    prior.agreement_signed_at = new Date().toISOString();
  }

  await input.admin
    .from("partner_profiles")
    .update({
      agreement_status: "signed",
      agreement_document_id: input.documentId,
      application_data: prior,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.partnerProfileId);
}

async function notifyIfActionNeeded(input: {
  admin: SupabaseClient;
  partnerProfileId: string;
  documentId: string;
  title: string;
  status: DocumentStatus;
  neededAction: DocumentNeededAction;
  documentKind: PartnerDocumentKind;
}) {
  if (input.status !== "action_needed") return;
  const action =
    resolveNeededAction({
      status: input.status,
      neededAction: input.neededAction,
      fileUrl: "present",
    }) ?? input.neededAction;
  const href = actionHrefFor(input.documentId, action, input.documentKind);
  await notifyPartnerDocumentActionNeeded({
    admin: input.admin,
    partnerProfileId: input.partnerProfileId,
    documentId: input.documentId,
    title: "Document needs your attention",
    body: input.title,
    href,
  });
}

export async function sharePartnerDocument(formData: FormData): Promise<AdminDocumentActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { admin, actorUserId, staffEmail } = loaded;

  const partnerProfileId = String(formData.get("partnerProfileId") ?? "").trim();
  if (!partnerProfileId) return { error: "Missing partner." };

  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const documentKind = parseDocumentKind(formData.get("documentKind") || "other");
  const program = parseDocumentProgram(formData.get("program") || null);
  let status = parseAdminDocumentStatus(formData.get("status")) ?? "current";
  let neededAction = parseNeededActionMeta(formData.get("neededAction"));
  const expirationDate = emptyDate(String(formData.get("expirationDate") ?? ""));
  const effectiveDate = emptyDate(String(formData.get("effectiveDate") ?? ""));
  const versionRaw = String(formData.get("version") ?? "1").trim();
  const version = Math.max(1, Number.parseInt(versionRaw, 10) || 1);

  if (status === "action_needed" && !neededAction) {
    return { error: "Choose a needed action when status is Action Needed." };
  }
  if (status !== "action_needed") neededAction = null;

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Files must be 25 MB or smaller." };
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return { error: "Use a PDF, DOCX, or image file." };
  }

  const { data: profile } = await admin
    .from("partner_profiles")
    .select("id")
    .eq("id", partnerProfileId)
    .maybeSingle();
  if (!profile) return { error: "Partner not found." };

  const path = storagePath(partnerProfileId, file.name);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadError) {
    return { error: uploadError.message || "Could not upload the file." };
  }

  const { data: document, error } = await admin
    .from("documents")
    .insert({
      title: title || file.name,
      file_url: path,
      context_type: "partner_profile",
      context_id: partnerProfileId,
      visibility: "internal",
      status,
      version,
      effective_date: effectiveDate,
      uploaded_by_user_id: actorUserId,
      shared_by_user_id: actorUserId,
    })
    .select("id")
    .single();

  if (error || !document) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: error?.message || "Could not save the document." };
  }

  const documentId = document.id as string;
  await upsertPartnerDocumentMeta(admin, {
    documentId,
    partnerProfileId,
    program,
    documentKind,
    expirationDate,
    neededAction,
  });

  await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "document",
    entityId: documentId,
    action: "admin_share",
    newValue: {
      partnerProfileId,
      title: title || file.name,
      status,
      documentKind,
      staffEmail,
    },
  });

  await notifyIfActionNeeded({
    admin,
    partnerProfileId,
    documentId,
    title: title || file.name,
    status,
    neededAction,
    documentKind,
  });

  revalidatePartnerDocs(partnerProfileId, documentId);
  return { ok: true, documentId };
}

export async function updatePartnerDocumentMeta(formData: FormData): Promise<AdminDocumentActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { admin, actorUserId } = loaded;

  const partnerProfileId = String(formData.get("partnerProfileId") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "").trim();
  if (!partnerProfileId || !documentId) return { error: "Missing document." };

  const doc = await assertPartnerLibraryDoc(admin, partnerProfileId, documentId);
  if (!doc) return { error: "That document could not be found." };

  const title = String(formData.get("title") ?? "").trim();
  const status = parseAdminDocumentStatus(formData.get("status"));
  if (!status) return { error: "Choose a valid status." };
  let neededAction = parseNeededActionMeta(formData.get("neededAction"));
  if (status === "action_needed" && !neededAction) {
    return { error: "Choose a needed action when status is Action Needed." };
  }
  if (status !== "action_needed") neededAction = null;

  const documentKind = parseDocumentKind(formData.get("documentKind") || "other");
  const program = parseDocumentProgram(formData.get("program") || null);
  const expirationDate = emptyDate(String(formData.get("expirationDate") ?? ""));
  const effectiveDate = emptyDate(String(formData.get("effectiveDate") ?? ""));
  const signedDate = emptyDate(String(formData.get("signedDate") ?? ""));
  const externalSignatureRef = emptyDate(
    String(formData.get("externalSignatureRef") ?? ""),
  );
  const versionRaw = String(formData.get("version") ?? "").trim();
  const version = Math.max(1, Number.parseInt(versionRaw, 10) || (doc.version as number) || 1);
  const supersededByRaw = String(formData.get("supersededByDocumentId") ?? "").trim();
  const supersededByDocumentId = supersededByRaw || null;

  if (supersededByDocumentId && supersededByDocumentId === documentId) {
    return { error: "A document cannot supersede itself." };
  }
  if (supersededByDocumentId) {
    const target = await assertPartnerLibraryDoc(
      admin,
      partnerProfileId,
      supersededByDocumentId,
    );
    if (!target) return { error: "Superseding document was not found." };
  }

  const priorStatus = (doc.status as DocumentStatus) ?? "current";

  const { error } = await admin
    .from("documents")
    .update({
      title: title || (doc.title as string),
      status,
      version,
      effective_date: effectiveDate,
      signed_date: signedDate,
      superseded_by_document_id: supersededByDocumentId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", partnerProfileId);

  if (error) return { error: error.message || "Could not update the document." };

  await upsertPartnerDocumentMeta(admin, {
    documentId,
    partnerProfileId,
    program,
    documentKind,
    expirationDate,
    externalSignatureRef,
    neededAction,
  });

  await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "document",
    entityId: documentId,
    action: "admin_update_meta",
    previousValue: { status: priorStatus },
    newValue: { status, neededAction, version, documentKind },
  });

  if (status === "action_needed" && priorStatus !== "action_needed") {
    await notifyIfActionNeeded({
      admin,
      partnerProfileId,
      documentId,
      title: title || (doc.title as string) || "Document",
      status,
      neededAction,
      documentKind,
    });
  }

  revalidatePartnerDocs(partnerProfileId, documentId);
  return { ok: true, documentId };
}

export async function sendForExternalSignature(formData: FormData): Promise<AdminDocumentActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { admin, actorUserId } = loaded;

  const partnerProfileId = String(formData.get("partnerProfileId") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "").trim();
  if (!partnerProfileId || !documentId) return { error: "Missing document." };

  const doc = await assertPartnerLibraryDoc(admin, partnerProfileId, documentId);
  if (!doc) return { error: "That document could not be found." };

  const guard = raceGuardError({
    status: (doc.status as string | null) ?? null,
    superseded_by_document_id:
      (doc.superseded_by_document_id as string | null) ?? null,
  });
  if (guard) return { error: guard };

  const file = formData.get("file");
  let fileUrl = (doc.file_url as string | null) ?? null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return { error: "Files must be 25 MB or smaller." };
    }
    if (!ALLOWED_EXT.test(file.name)) {
      return { error: "Use a PDF, DOCX, or image file." };
    }
    const path = storagePath(partnerProfileId, file.name);
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uploadError) {
      return { error: uploadError.message || "Could not upload the file." };
    }
    fileUrl = path;
  }

  const { data: claimed, error } = await admin
    .from("documents")
    .update({
      status: "action_needed",
      file_url: fileUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", partnerProfileId)
    .is("superseded_by_document_id", null)
    .neq("status", "archived")
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message || "Could not update the document." };
  if (!claimed) return { error: "This document was already updated." };

  const { data: meta } = await admin
    .from("partner_document_meta")
    .select("document_kind, program, expiration_date, external_signature_ref")
    .eq("document_id", documentId)
    .maybeSingle();

  const documentKind = parseDocumentKind(meta?.document_kind ?? "agreement");
  await upsertPartnerDocumentMeta(admin, {
    documentId,
    partnerProfileId,
    program: parseDocumentProgram(meta?.program),
    expirationDate: (meta?.expiration_date as string | null) ?? null,
    externalSignatureRef: (meta?.external_signature_ref as string | null) ?? null,
    documentKind,
    neededAction: "sign_externally",
  });

  await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "document",
    entityId: documentId,
    action: "send_for_external_signature",
  });

  await notifyIfActionNeeded({
    admin,
    partnerProfileId,
    documentId,
    title: (doc.title as string) || "Document",
    status: "action_needed",
    neededAction: "sign_externally",
    documentKind,
  });

  revalidatePartnerDocs(partnerProfileId, documentId);
  return { ok: true, documentId };
}

/**
 * Claim-then-insert race-safe supersede for signed copies.
 * Second writer sees archived/superseded and fails.
 */
export async function uploadSignedCopyAsAdmin(formData: FormData): Promise<AdminDocumentActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { admin, actorUserId } = loaded;

  const partnerProfileId = String(formData.get("partnerProfileId") ?? "").trim();
  const documentId = String(formData.get("documentId") ?? "").trim();
  const signatureRef = String(formData.get("externalSignatureRef") ?? "").trim();
  if (!partnerProfileId || !documentId) return { error: "Missing document." };

  const doc = await assertPartnerLibraryDoc(admin, partnerProfileId, documentId);
  if (!doc) return { error: "That document could not be found." };

  const early = raceGuardError({
    status: (doc.status as string | null) ?? null,
    superseded_by_document_id:
      (doc.superseded_by_document_id as string | null) ?? null,
  });
  if (early) return { error: early };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the signed file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Files must be 25 MB or smaller." };
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return { error: "Use a PDF, DOCX, or image file." };
  }

  const path = storagePath(partnerProfileId, file.name);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadError) {
    return { error: uploadError.message || "Could not upload the file." };
  }

  const version = ((doc.version as number) ?? 1) + 1;
  const signedDate = new Date().toISOString().slice(0, 10);

  const { data: next, error: insertError } = await admin
    .from("documents")
    .insert({
      title: (doc.title as string) || file.name,
      file_url: path,
      context_type: "partner_profile",
      context_id: partnerProfileId,
      visibility: (doc.visibility as string) || "internal",
      status: "completed",
      version,
      signed_date: signedDate,
      effective_date:
        (doc.effective_date as string | null) ?? signedDate,
      uploaded_by_user_id: actorUserId,
      shared_by_user_id: actorUserId,
    })
    .select("id")
    .single();

  if (insertError || !next) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: insertError?.message || "Could not save the signed copy." };
  }

  const nextId = next.id as string;

  const { data: claimed, error: claimError } = await admin
    .from("documents")
    .update({
      status: "archived",
      superseded_by_document_id: nextId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", partnerProfileId)
    .is("superseded_by_document_id", null)
    .neq("status", "archived")
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    await admin.from("documents").delete().eq("id", nextId);
    await admin.storage.from(BUCKET).remove([path]);
    return { error: "This document was already updated." };
  }

  const { data: oldLabels } = await admin
    .from("document_labels")
    .select("label_text")
    .eq("document_id", documentId);

  if (oldLabels && oldLabels.length > 0) {
    await admin.from("document_labels").insert(
      oldLabels.map((row) => ({
        document_id: nextId,
        label_text: row.label_text as string,
        created_by_user_id: actorUserId,
      })),
    );
  }

  await copyPartnerDocumentMeta({
    writer: admin,
    fromDocumentId: documentId,
    toDocumentId: nextId,
    partnerProfileId,
    overrides: {
      neededAction: null,
      externalSignatureRef: signatureRef || null,
    },
  });

  const { data: meta } = await admin
    .from("partner_document_meta")
    .select("document_kind")
    .eq("document_id", nextId)
    .maybeSingle();
  const documentKind = parseDocumentKind(meta?.document_kind);

  if (documentKind === "agreement") {
    await syncAgreementProfile({
      admin,
      partnerProfileId,
      documentId: nextId,
      signedDate,
    });
  }

  await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "document",
    entityId: nextId,
    action: "admin_signed_copy",
    previousValue: { document_id: documentId },
    newValue: { document_id: nextId, signed_date: signedDate },
  });

  revalidatePartnerDocs(partnerProfileId, nextId);
  revalidatePartnerDocs(partnerProfileId, documentId);
  return { ok: true, documentId: nextId };
}

export async function createAmendment(formData: FormData): Promise<AdminDocumentActionResult> {
  const loaded = await adminWriter();
  if ("error" in loaded) return { error: loaded.error };
  const { admin, actorUserId } = loaded;

  const partnerProfileId = String(formData.get("partnerProfileId") ?? "").trim();
  const priorDocumentId = String(formData.get("priorDocumentId") ?? "").trim();
  if (!partnerProfileId || !priorDocumentId) {
    return { error: "Missing prior document." };
  }

  const prior = await assertPartnerLibraryDoc(admin, partnerProfileId, priorDocumentId);
  if (!prior) return { error: "That document could not be found." };

  const early = raceGuardError({
    status: (prior.status as string | null) ?? null,
    superseded_by_document_id:
      (prior.superseded_by_document_id as string | null) ?? null,
  });
  if (early) return { error: early };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the amendment file." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Files must be 25 MB or smaller." };
  }
  if (!ALLOWED_EXT.test(file.name)) {
    return { error: "Use a PDF, DOCX, or image file." };
  }

  const title =
    String(formData.get("title") ?? "").trim() ||
    `${(prior.title as string) || "Document"} (amendment)`;
  const effectiveDate = emptyDate(String(formData.get("effectiveDate") ?? ""));
  const status = parseAdminDocumentStatus(formData.get("status")) ?? "current";
  let neededAction = parseNeededActionMeta(formData.get("neededAction"));
  if (status === "action_needed" && !neededAction) {
    return { error: "Choose a needed action when status is Action Needed." };
  }
  if (status !== "action_needed") neededAction = null;

  const path = storagePath(partnerProfileId, file.name);
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadError) {
    return { error: uploadError.message || "Could not upload the file." };
  }

  const version = ((prior.version as number) ?? 1) + 1;

  const { data: next, error: insertError } = await admin
    .from("documents")
    .insert({
      title,
      file_url: path,
      context_type: "partner_profile",
      context_id: partnerProfileId,
      visibility: (prior.visibility as string) || "internal",
      status,
      version,
      effective_date: effectiveDate,
      uploaded_by_user_id: actorUserId,
      shared_by_user_id: actorUserId,
    })
    .select("id")
    .single();

  if (insertError || !next) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: insertError?.message || "Could not save the amendment." };
  }

  const nextId = next.id as string;

  const { data: claimed, error: claimError } = await admin
    .from("documents")
    .update({
      status: "archived",
      superseded_by_document_id: nextId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", priorDocumentId)
    .eq("context_type", "partner_profile")
    .eq("context_id", partnerProfileId)
    .is("superseded_by_document_id", null)
    .neq("status", "archived")
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    await admin.from("documents").delete().eq("id", nextId);
    await admin.storage.from(BUCKET).remove([path]);
    return { error: "This document was already updated." };
  }

  await copyPartnerDocumentMeta({
    writer: admin,
    fromDocumentId: priorDocumentId,
    toDocumentId: nextId,
    partnerProfileId,
    overrides: {
      neededAction,
    },
  });

  const { data: meta } = await admin
    .from("partner_document_meta")
    .select("document_kind")
    .eq("document_id", nextId)
    .maybeSingle();
  const documentKind = parseDocumentKind(meta?.document_kind);

  await writePartnerAdminAudit(admin, {
    actorUserId,
    entityType: "document",
    entityId: nextId,
    action: "admin_amendment",
    previousValue: { document_id: priorDocumentId },
    newValue: { document_id: nextId, version },
  });

  await notifyIfActionNeeded({
    admin,
    partnerProfileId,
    documentId: nextId,
    title,
    status,
    neededAction,
    documentKind,
  });

  revalidatePartnerDocs(partnerProfileId, nextId);
  revalidatePartnerDocs(partnerProfileId, priorDocumentId);
  return { ok: true, documentId: nextId };
}
