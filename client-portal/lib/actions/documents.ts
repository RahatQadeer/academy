"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { resolveDocumentUrl } from "@/base/lib/documents";
import { TOASTS } from "@/client-portal/lib/toasts";
import { IN_APP, notifyWorkspaceMembers } from "@/whitbyos/lib/notify";
import { isSignablePdf } from "@/base/lib/signing/placement";
import { signFromForm, signedFileName } from "@/base/lib/signing/stamp";
import { requireRead, requireWrite, text, toastUrl, type LiveContext } from "./guard";

const DOCUMENTS_PATH = "/client-portal/documents";
const BUCKET = "documents";
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Client upload. The file goes to Supabase Storage under the client's own
 * prefix, then a base `documents` row is created at `client_visible` — a client
 * can never create an `internal` or `restricted` document.
 */
export async function uploadDocument(formData: FormData) {
  const file = formData.get("file");
  const title = text(formData, "title");

  if (!(file instanceof File) || file.size === 0) {
    redirect(toastUrl(`${DOCUMENTS_PATH}?upload=1`, "Choose a file to upload."));
  }
  if (file.size > MAX_BYTES) {
    redirect(toastUrl(`${DOCUMENTS_PATH}?upload=1`, "Files must be 25 MB or smaller."));
  }

  const guard = await requireWrite("documents");
  if ("reason" in guard) redirect(toastUrl(DOCUMENTS_PATH, guard.reason));
  const { ctx } = guard;

  const supabase = await createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${ctx.clientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    redirect(toastUrl(DOCUMENTS_PATH, "Upload failed. Please try again."));
  }

  const requestId = text(formData, "requestId");
  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      title: title ?? file.name,
      file_url: path,
      context_type: requestId ? "request" : "client",
      context_id: requestId ?? ctx.clientId,
      visibility: "client_visible",
      status: "current",
      version: 1,
      uploaded_by_user_id: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !document) {
    await supabase.storage.from(BUCKET).remove([path]);
    redirect(toastUrl(DOCUMENTS_PATH, "Could not save the document. Please try again."));
  }

  const label = text(formData, "label");
  if (label) {
    await supabase.from("document_labels").insert({
      document_id: document.id,
      label_text: label,
      created_by_user_id: ctx.userId,
    });
  }

  // Something a client hands over is something the team has to look at, which
  // is what 17.3's "Document needs review" switch is for.
  await notifyWorkspaceMembers({
    workspaceId: ctx.workspaceId,
    event: IN_APP.documentReview,
    title: "Client uploaded a document",
    body: `${ctx.accountName}: ${title ?? file.name}`,
    href: `/whitbyos/documents?doc=${document.id}`,
    entityType: "document",
    entityId: document.id,
  });

  revalidatePath(DOCUMENTS_PATH);
  redirect(toastUrl(DOCUMENTS_PATH, TOASTS.documentUploaded));
}

/**
 * Documents client uploads land in a private bucket, so those open through a
 * short-lived signed URL minted per click rather than a stored public link
 * (base cursor.md 3.5). Documents the professional files have no bucket object
 * at all — WhitbyOS records a link to wherever the file already lives (SRS
 * 14.12) — so `resolveDocumentUrl` tells the two shapes apart rather than
 * assuming every `file_url` is a Storage path.
 */
export async function downloadDocument(formData: FormData) {
  const documentId = formData.get("documentId");
  if (typeof documentId !== "string" || !documentId) {
    redirect(toastUrl(DOCUMENTS_PATH, "That document could not be found."));
  }

  // A read, not a write: a view-only member may take a copy of a document they
  // are permitted to see. `requireRead` answers with the sample-account reason
  // when there is no live identity, which is what a demo document has always
  // said when asked for a file it does not have.
  const guard = await requireRead("documents");
  if ("reason" in guard) redirect(toastUrl(DOCUMENTS_PATH, guard.reason));

  const supabase = await createClient();

  // Re-read through RLS: a client may only ever download a client_visible file.
  const { data: document } = await supabase
    .from("documents")
    .select("file_url, visibility")
    .eq("id", documentId)
    .eq("visibility", "client_visible")
    .maybeSingle();

  if (!document?.file_url) {
    redirect(toastUrl(DOCUMENTS_PATH, "That document is no longer available to you."));
  }

  const url = await resolveDocumentUrl(supabase, document.file_url);
  if (!url) {
    redirect(toastUrl(DOCUMENTS_PATH, "Could not open that file. Please try again."));
  }

  redirect(url);
}

/** Labels are organisational only — they never change permissions (SRS 14.4). */
export async function addDocumentLabel(formData: FormData) {
  const documentId = formData.get("documentId");
  const label = text(formData, "label");

  if (typeof documentId !== "string" || !documentId || !label) {
    redirect(toastUrl(`${DOCUMENTS_PATH}?tab=labels`, "Enter a label."));
  }

  const guard = await requireWrite("documents");
  if ("reason" in guard) {
    redirect(toastUrl(`${DOCUMENTS_PATH}?tab=labels`, guard.reason));
  }
  const { ctx } = guard;

  const supabase = await createClient();
  await supabase.from("document_labels").insert({
    document_id: documentId,
    label_text: label,
    created_by_user_id: ctx.userId,
  });

  revalidatePath(DOCUMENTS_PATH);
  redirect(toastUrl(`${DOCUMENTS_PATH}?tab=labels`, TOASTS.labelAdded));
}

/**
 * The client's half of the signing round trip (whitbyos/072).
 *
 * Declining, now. Signing used to go through here too and did nothing to the
 * paper — a flag, a date, and the unsigned file left as it was. It files a
 * signed copy instead (`signWithTypedSignature`, `uploadSignedCopy`), and only
 * the refusal is still an answer with no file attached.
 *
 * The document has to be one this client may already see and one they are
 * actually being asked to sign — a document sent to the professional is not
 * theirs to answer, and RLS alone would not say so.
 */
async function answerSignature(formData: FormData, outcome: "signed" | "declined") {
  const documentId = text(formData, "documentId");
  const note = text(formData, "note");

  const guard = await requireWrite("documents");
  if ("reason" in guard) redirect(toastUrl(DOCUMENTS_PATH, guard.reason));

  if (!documentId) redirect(toastUrl(DOCUMENTS_PATH, "That document could not be found."));

  const supabase = await createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("id, title, signature_required_from, signature_state")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) {
    redirect(toastUrl(DOCUMENTS_PATH, "That document could not be found."));
  }

  if (
    document.signature_state !== "awaiting" ||
    document.signature_required_from !== "client"
  ) {
    redirect(toastUrl(DOCUMENTS_PATH, "This document is not waiting on your signature."));
  }

  /**
   * Through `portal_answer_signature` (073) rather than a direct update.
   * `documents_write` is the uploader or somebody in their workspace, and a
   * portal client is neither — they can read a `client_visible` document and
   * could not change one byte of it, so this update was refused outright and
   * came back as "could not be saved".
   *
   * The function checks the same two things again on the way in, and writes
   * only the signature columns. The notice to the firm goes out from inside
   * it, because a client cannot insert a notification either.
   */
  const { data: answered, error } = await supabase.rpc("portal_answer_signature", {
    p_document_id: documentId,
    p_outcome: outcome,
    p_note: note,
  });

  if (error || answered !== true) {
    redirect(toastUrl(DOCUMENTS_PATH, "That could not be saved. Please try again."));
  }

  revalidatePath(DOCUMENTS_PATH);
  redirect(
    toastUrl(
      DOCUMENTS_PATH,
      outcome === "signed" ? "Signed. Your team has been told." : "Declined. Your team has been told.",
    ),
  );
}

export async function declineDocument(formData: FormData) {
  await answerSignature(formData, "declined");
}


/**
 * The client asking the professional to sign something.
 *
 * The other direction of the same round trip. A client uploads a document and
 * needs a signature on it as often as the firm does, and until now only the
 * firm could ask — so the client's own paperwork sat on a screen with nothing
 * to do about it.
 *
 * Nothing about visibility to arrange here: a document the client can see is
 * already `client_visible`, and the firm sees everything on its own clients.
 */
export async function requestProfessionalSignature(formData: FormData) {
  const documentId = text(formData, "documentId");

  const guard = await requireWrite("documents");
  if ("reason" in guard) redirect(toastUrl(DOCUMENTS_PATH, guard.reason));
  const { ctx } = guard;

  if (!documentId) redirect(toastUrl(DOCUMENTS_PATH, "That document could not be found."));

  const supabase = await createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("id, title, file_url, signature_state")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) {
    redirect(toastUrl(DOCUMENTS_PATH, "That document could not be found."));
  }

  if (!String(document.file_url ?? "").trim()) {
    redirect(toastUrl(DOCUMENTS_PATH, "There is no file on this document to sign."));
  }

  if (document.signature_state === "awaiting") {
    redirect(toastUrl(DOCUMENTS_PATH, "This document is already waiting on a signature."));
  }

  // A signature is placed on a PDF, so that is what can be sent for one. A
  // Word file would reach the other side as something they could only print.
  if (!isSignablePdf(document.file_url as string)) {
    redirect(
      toastUrl(DOCUMENTS_PATH, "Only a PDF can be sent for signature. Upload a PDF copy and send that."),
    );
  }

  // Same reason as answering: a client cannot write to `documents` at all.
  const { data: sent, error } = await supabase.rpc("portal_request_signature", {
    p_document_id: documentId,
  });

  if (error || sent !== true) {
    redirect(toastUrl(DOCUMENTS_PATH, "That could not be sent. Please try again."));
  }

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "active");

  const ids = (members ?? []).map((row) => row.user_id as string).filter(Boolean);
  if (ids.length > 0) {
    await supabase.from("whitbyos_notifications").insert(
      ids.map((userId) => ({
        workspace_id: ctx.workspaceId,
        recipient_user_id: userId,
        recipient_contact_id: null,
        kind: "signature_requested",
        title: "A document needs your signature",
        body: (document.title as string) ?? "Document",
        href: `/whitbyos/documents?tab=action&doc=${documentId}`,
        entity_type: "document",
        entity_id: documentId,
      })),
    );
  }

  revalidatePath(DOCUMENTS_PATH);
  redirect(toastUrl(DOCUMENTS_PATH, "Sent. Your team has been asked to sign it."));
}

const SIGNED_COPY_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const SIGNED_COPY_EXTENSIONS = /\.(pdf|png|jpe?g|docx)$/i;

type SignResult = { error: string } | void;

/**
 * The document a client is being asked to sign, re-read on the way in.
 *
 * Both ways of signing start here: the screen that offered the button is not
 * evidence the document is still waiting, and RLS only says the client may see
 * it, not that it is theirs to answer.
 */
type AwaitingDocument =
  | { error: string }
  | {
      ctx: LiveContext;
      supabase: Awaited<ReturnType<typeof createClient>>;
      document: { id: string; title: string; file_url: string | null };
    };

async function documentAwaitingClient(documentId: string | null): Promise<AwaitingDocument> {
  const guard = await requireWrite("documents");
  if ("reason" in guard) return { error: guard.reason };
  if (!documentId) return { error: "That document could not be found." };

  const supabase = await createClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id, title, file_url, signature_required_from, signature_state")
    .eq("id", documentId)
    .eq("visibility", "client_visible")
    .maybeSingle();

  if (!document) return { error: "That document could not be found." };
  if (document.signature_state !== "awaiting" || document.signature_required_from !== "client") {
    return { error: "This document is not waiting on your signature." };
  }

  return {
    ctx: guard.ctx,
    supabase,
    document: {
      id: document.id as string,
      title: document.title as string,
      file_url: (document.file_url as string | null) ?? null,
    },
  };
}


/**
 * File the signed copy against the original, through `portal_file_signed_copy`
 * (whitbyos/092). A client cannot archive the original or write their own
 * answer, and the function does both after asking the same questions again.
 *
 * The object is removed if the filing fails, so a refused signature does not
 * leave an orphaned file in the bucket.
 */
async function fileSignedCopy(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    documentId: string;
    path: string;
    method: "typed" | "uploaded";
    name: string | null;
    note: string | null;
  },
): Promise<SignResult> {
  const { data: signedId, error } = await supabase.rpc("portal_file_signed_copy", {
    p_document_id: input.documentId,
    p_file_path: input.path,
    p_method: input.method,
    p_signed_name: input.name,
    p_note: input.note,
  });

  if (error || !signedId) {
    await supabase.storage.from(BUCKET).remove([input.path]);
    return { error: "The signed copy could not be saved. Please try again." };
  }

  revalidatePath(DOCUMENTS_PATH);
  redirect(toastUrl(DOCUMENTS_PATH, "Signed. Your team has the signed copy."));
}

/**
 * Sign on screen: the typed name, drawn in a signature face, put where the
 * client placed it on the page.
 *
 * The browser sends only the pictures and their positions. The PDF is read
 * from Storage here and stamped here, so what is filed is the firm's own
 * document with the signature added — never a file the browser substituted.
 *
 * Returns the problem rather than redirecting with it: the client has placed
 * signatures across the document, and a toast on a reloaded page would throw
 * all of that away to tell them one thing.
 */
export async function signWithTypedSignature(formData: FormData): Promise<SignResult> {
  const found = await documentAwaitingClient(text(formData, "documentId"));
  if ("error" in found) return { error: found.error };
  const { ctx, supabase, document } = found;

  const fileUrl = String(document.file_url ?? "");
  if (!isSignablePdf(fileUrl)) {
    return { error: "Only a PDF can be signed here. Download it and upload a signed copy instead." };
  }

  const { data: stored, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(fileUrl);
  if (downloadError || !stored) return { error: "The document could not be opened. Please try again." };

  const stamped = await signFromForm(formData, new Uint8Array(await stored.arrayBuffer()));
  if ("error" in stamped) return { error: stamped.error };
  const { name } = stamped;

  const path = `${ctx.clientId}/${Date.now()}-${signedFileName(document.title, "pdf")}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, stamped.bytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { error: "The signed copy could not be saved. Please try again." };

  return fileSignedCopy(supabase, {
    documentId: document.id,
    path,
    method: "typed",
    name,
    note: text(formData, "note"),
  });
}

/**
 * Sign on paper: download, print, sign, scan or photograph, send back.
 *
 * For a document that cannot be signed on screen, and for anybody who would
 * simply rather sign with a pen. What comes back is filed as the signed copy
 * exactly as it arrived — the firm reads it, the portal does not.
 */
export async function uploadSignedCopy(formData: FormData): Promise<SignResult> {
  const found = await documentAwaitingClient(text(formData, "documentId"));
  if ("error" in found) return { error: found.error };
  const { ctx, supabase, document } = found;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the signed copy to upload." };
  if (file.size > MAX_BYTES) return { error: "Files must be 25 MB or smaller." };
  if (!SIGNED_COPY_EXTENSIONS.test(file.name) || (file.type && !SIGNED_COPY_TYPES.has(file.type))) {
    return { error: "Upload the signed copy as a PDF, a photo (PNG or JPG), or a Word file." };
  }

  const extension = file.name.split(".").pop()!.toLowerCase();
  const path = `${ctx.clientId}/${Date.now()}-${signedFileName(document.title, extension)}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) return { error: "Upload failed. Please try again." };

  return fileSignedCopy(supabase, {
    documentId: document.id,
    path,
    method: "uploaded",
    name: null,
    note: text(formData, "note"),
  });
}
