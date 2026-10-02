"use server";

import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { DOCUMENTS_BUCKET, storeDocumentFile } from "@/whitbyos/lib/document-storage";
import { isSignablePdf } from "@/base/lib/signing/placement";
import { signFromForm, signedFileName } from "@/base/lib/signing/stamp";
import { DOCUMENT_STATUS, VISIBILITY } from "@/whitbyos/lib/document-vocab";
import { isWorkspaceReadOnly, READ_ONLY_MESSAGE, stopIfReadOnly } from "@/whitbyos/lib/read-only";
import {
  IN_APP,
  notifyClientContacts,
  notifyRequestAudience,
  notifyWorkspaceMembers,
} from "@/whitbyos/lib/notify";
import { isUnlinkedDocument, listDocuments, neededAction } from "@/whitbyos/lib/documents";
import { listProviderDocumentContexts } from "@/whitbyos/lib/providers";
import { recordTimelineEvent, TIMELINE_EVENT } from "@/whitbyos/lib/timeline-events";

const LIST = "/whitbyos/documents";
const ROUTE = "/[product]/[[...slug]]";

const STATUSES = new Set(DOCUMENT_STATUS.map((s) => s.value as string));
const VISIBILITIES = new Set(VISIBILITY.map((v) => v.value as string));

function backWithError(formData: FormData, message: string): never {
  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (returnTo.startsWith("/whitbyos/")) {
    const [path, query] = returnTo.split("?");
    const params = new URLSearchParams(query);
    params.set("upload", "1");
    params.set("error", message);
    redirect(`${path}?${params.toString()}`);
  }
  redirect(`${LIST}?new=1&error=${encodeURIComponent(message)}`);
}

function documentsReturn(formData: FormData, extra: Record<string, string> = {}, fallback = LIST): never {
  const returnTo = String(formData.get("return_to") ?? "").trim();
  const base = returnTo.startsWith("/whitbyos/documents") ? returnTo : fallback;
  const [path, query] = base.split("?");
  const params = new URLSearchParams(query);
  params.delete("sign");
  params.delete("update");
  params.delete("error");
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  redirect(qs ? `${path}?${qs}` : path);
}

/**
 * Screen 12.2 — Upload Document.
 *
 * A file on the dropzone is the usual case. The Request link is optional
 * (§12.2), and what "none" means depends on where you are standing: inside a
 * client's workspace it is filed on that client, which is the whole reason
 * the picker no longer offers the client as a thing to link to. With no
 * client open there is nowhere better, so it goes against the workspace's own
 * id — `isUnlinkedDocument` — which is how it still appears on All.
 */
export async function uploadDocument(formData: FormData) {
  await stopIfReadOnly();

  const title = String(formData.get("title") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();
  const fileUrl = String(formData.get("file_url") ?? "").trim();
  const file = formData.get("file");
  const status = String(formData.get("status") ?? "current").trim();
  const visibility = String(formData.get("visibility") ?? "internal").trim();
  const labels = String(formData.get("labels") ?? "").trim();
  const effective = String(formData.get("effective_date") ?? "").trim();
  const expires = String(formData.get("expires_at") ?? "").trim();

  const hasFile = file instanceof File && file.size > 0;

  if (!title) backWithError(formData, "Give the document a title.");
  if (!hasFile && !fileUrl) backWithError(formData, "Drop a file here, or click to browse.");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError(formData, "Create your workspace first.");

  let contextType = "client";
  let contextId = (await getOpenClientId()) ?? workspaceId;

  if (context) {
    const [type, id] = context.split(":");
    if (!type || !id) {
      backWithError(formData, "Choose a client, request or provider, or leave it unlinked.");
    }
    contextType = type;
    contextId = id;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`${LIST}?expired=1`);

  // Prove the thing it is being filed against is this workspace's, so a
  // document cannot be hung off someone else's client by editing the form.
  // Unlinked files skip this: they hang off the workspace id itself.
  if (!isUnlinkedDocument(contextType, contextId, workspaceId)) {
    if (contextType === "company" || contextType === "contact") {
      // A provider is filed against the company or the person it is, and
      // neither table is scoped by workspace — `companies` and `contacts` are
      // base records shared with the Portal and the Partner Center. What makes
      // this id this workspace's is that one of its providers points at it, so
      // that is what gets proved.
      const providers = await listProviderDocumentContexts();
      const owned = providers.some(
        (provider) =>
          provider.contextType === contextType && provider.contextId === contextId,
      );
      if (!owned) backWithError(formData, "That provider is not in this workspace.");
    } else {
      const table = contextType === "client" ? "whitbyos_clients" : "whitbyos_requests";
      const { data: parent } = await supabase
        .from(table)
        .select("id")
        .eq("id", contextId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (!parent) backWithError(formData, "That client or request is not in this workspace.");
    }
  }

  // A chosen file wins over a typed link: somebody who did both meant the file.
  let stored = fileUrl;
  if (hasFile) {
    const result = await storeDocumentFile(supabase, workspaceId, file);
    if (result && "error" in result) backWithError(formData, result.error);
    if (result && "path" in result) stored = result.path;
  }

  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      title,
      file_url: stored,
      context_type: contextType,
      context_id: contextId,
      status: STATUSES.has(status) ? status : "current",
      visibility: VISIBILITIES.has(visibility) ? visibility : "internal",
      effective_date: effective || null,
      expires_at: expires || null,
      uploaded_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !document) backWithError(formData, error?.message ?? "Could not save the document.");

  // A Request's history is what happened on it, and a document arriving is one
  // of those things. Only for a Request: the timeline table is Request-scoped
  // by its own schema, and a document filed against a client or a provider has
  // no Request to belong to.
  if (contextType === "request") {
    await recordTimelineEvent({
      requestId: contextId,
      eventType: TIMELINE_EVENT.documentAdded,
      description: `A document was added: ${title}`,
      sourceReference: document.id as string,
      // The document's own visibility decides. Naming a client-visible file in
      // a history the client cannot see, or an internal one in a history they
      // can, would each be wrong in their own direction.
      clientVisible: VISIBILITIES.has(visibility) && visibility === "client_visible",
    });
  }

  const savedStatus = STATUSES.has(status) ? status : "current";
  if (savedStatus === "action_needed") {
    await notifyWorkspaceMembers({
      workspaceId,
      event: IN_APP.documentReview,
      title: "Document needs review",
      body: title,
      href: `${LIST}?doc=${document.id}`,
      entityType: "document",
      entityId: document.id,
    });
  }

  // Filing a Client Visible document is sharing it: the portal lists it from
  // this moment. Internal and Restricted never reach the portal, so they never
  // ring its bell either.
  const savedVisibility = VISIBILITIES.has(visibility) ? visibility : "internal";
  if (
    savedVisibility === "client_visible" &&
    !isUnlinkedDocument(contextType, contextId, workspaceId)
  ) {
    const askedFor = savedStatus === "action_needed";
    const notice = {
      workspaceId,
      event: askedFor ? ("action_needed" as const) : ("document_shared" as const),
      area: "documents" as const,
      title: askedFor ? "A document needs your attention" : "New document shared",
      body: title,
      href: "/client-portal/documents",
      entityType: "document",
      entityId: document.id as string,
    };

    if (contextType === "request") {
      await notifyRequestAudience({ ...notice, requestId: contextId });
    } else {
      await notifyClientContacts({ ...notice, clientId: contextId });
    }
  }

  const words = labels
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

  if (words.length > 0) {
    await supabase.from("document_labels").insert(
      words.map((label_text) => ({
        document_id: document.id,
        label_text,
        created_by_user_id: user.id,
      })),
    );
  }

  revalidatePath(ROUTE, "page");
  const returnTo = String(formData.get("return_to") ?? "").trim();
  redirect(
    returnTo.startsWith("/whitbyos/")
      ? returnTo
      : `${LIST}?uploaded=${encodeURIComponent(title)}`,
  );
}

/**
 * Screen 12.3's Download.
 *
 * Hands off to the same-origin download route so a stored Gmail URL cannot
 * replace this tab, and a real file is saved rather than opened in-place.
 */
export async function openDocument(formData: FormData) {
  const documentId = String(formData.get("document_id") ?? "").trim();
  if (!documentId) redirect(LIST);
  redirect(`/api/whitbyos/documents/${documentId}/download`);
}

/**
 * 21a's Review, and 21a2's fallback.
 *
 * Signing happens here rather than being handed to somebody else's product.
 * 21a2 drew a connected e-signature provider and the DocuSign integration that
 * went with it; both are gone. A document is sent to the side that has to sign
 * it, they sign or decline, and the answer comes back — which is the round
 * trip the integration was standing in for.
 */
export async function resolveDocument(formData: FormData) {
  await stopIfReadOnly();

  const documentId = String(formData.get("document_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  if (!documentId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  // 21a's "Upload Signed Copy" — the signed file, when it came back with the
  // signature. A new version rather than an overwrite: the unsigned original
  // is the record of what was sent out, and §1.16 keeps it.
  const signedUrl = String(formData.get("signed_url") ?? "").trim();
  const signedFile = formData.get("signed_file");
  const hasSignedFile = signedFile instanceof File && signedFile.size > 0;

  if (action === "sign" && (signedUrl || hasSignedFile)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // The signed copy comes back as a file far more often than as a link.
      let stored = signedUrl;
      if (hasSignedFile) {
        const result = await storeDocumentFile(supabase, workspaceId, signedFile);
        if (result && "error" in result) {
          documentsReturn(formData, { sign: documentId, error: result.error }, `${LIST}?tab=action`);
        }
        if (result && "path" in result) stored = result.path;
      }

      const filed = await fileSignedVersion(supabase, {
        workspaceId,
        userId: user.id,
        documentId,
        fileUrl: stored,
      });
      if ("error" in filed) {
        documentsReturn(formData, { sign: documentId, error: filed.error }, `${LIST}?tab=action`);
      }

      revalidatePath(ROUTE, "page");
      documentsReturn(formData, { signed: "1" }, `${LIST}?tab=action`);
    }
  }

  const fields =
    action === "sign"
      ? { status: "completed", signed_date: new Date().toISOString().slice(0, 10) }
      : { status: "current" };

  await supabase
    .from("documents")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", documentId);

  revalidatePath(ROUTE, "page");
  documentsReturn(formData, {}, `${LIST}?tab=action`);
}

/**
 * File a signed copy as the document's next version.
 *
 * Every way the professional signs ends here: placed on screen, uploaded after
 * signing on paper, or a link to a copy signed somewhere else. A new version
 * rather than an overwrite — the unsigned original is the record of what was
 * sent out, and §1.16 keeps it — archived and pointing at what replaced it.
 * Labels come along, the asking is answered on the new row rather than the
 * archived one, and the client is told.
 *
 * `signer` is only for what was signed in the app (whitbyos/092's columns): a
 * link recorded here says nothing about who signed it or how.
 */
async function fileSignedVersion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    workspaceId: string;
    userId: string;
    documentId: string;
    fileUrl: string;
    signer?: { name: string | null; method: "typed" | "uploaded"; note: string | null };
  },
): Promise<{ id: string } | { error: string }> {
  const { data: previous } = await supabase
    .from("documents")
    .select(
      "id, title, context_type, context_id, visibility, version, effective_date, expires_at, signature_required_from",
    )
    .eq("id", input.documentId)
    .maybeSingle();

  if (!previous) return { error: "That document is not in this workspace." };

  const now = new Date().toISOString();
  const { data: signed, error } = await supabase
    .from("documents")
    .insert({
      title: previous.title,
      file_url: input.fileUrl,
      context_type: previous.context_type,
      context_id: previous.context_id,
      visibility: previous.visibility,
      status: "completed",
      version: ((previous.version as number) ?? 1) + 1,
      effective_date: previous.effective_date,
      expires_at: previous.expires_at,
      signed_date: now.slice(0, 10),
      uploaded_by_user_id: input.userId,
      // Whoever was asked is who signed. A document nobody formally asked
      // about, signed from Action Needed, was signed by this side.
      signature_required_from: (previous.signature_required_from as string | null) ?? "professional",
      signature_state: "signed",
      signature_actioned_at: now,
      ...(input.signer
        ? {
            signature_note: input.signer.note,
            signature_signed_name: input.signer.name,
            signature_method: input.signer.method,
          }
        : {}),
    })
    .select("id")
    .single();

  if (error || !signed) return { error: error?.message ?? "Could not save the signed copy." };

  // The original stops asking anybody: it is archived, and a document nobody
  // can act on should not go on saying somebody has to.
  await supabase
    .from("documents")
    .update({
      status: "archived",
      superseded_by_document_id: signed.id,
      signature_required_from: null,
      signature_state: null,
      updated_at: now,
    })
    .eq("id", input.documentId);

  // Labels belong to the document, so the signed copy inherits them — the
  // same rule a renewal follows in updateDocument.
  const { data: labels } = await supabase
    .from("document_labels")
    .select("label_text")
    .eq("document_id", input.documentId);

  if (labels && labels.length > 0) {
    await supabase.from("document_labels").insert(
      labels.map((row) => ({
        document_id: signed.id,
        label_text: row.label_text as string,
        created_by_user_id: input.userId,
      })),
    );
  }

  const context = await documentClient(supabase, signed.id as string, input.workspaceId);
  if (context?.clientId) {
    await notifyClientContacts({
      workspaceId: input.workspaceId,
      clientId: context.clientId,
      event: "document_shared",
      area: "documents",
      kind: "signature_signed",
      title: "A document was signed",
      body: input.signer?.name ? `${context.title}, signed by ${input.signer.name}` : context.title,
      href: "/client-portal/documents",
      entityType: "document",
      entityId: signed.id as string,
    });
  }

  return { id: signed.id as string };
}

type SigningResult = { error: string } | void;

/**
 * The document the professional is about to sign, re-checked on the way in:
 * one this workspace can reach, and one whose row is asking for a signature.
 * The screen that offered the button is not evidence of either.
 */
async function documentToSign(documentId: string) {
  if (await isWorkspaceReadOnly()) return { error: READ_ONLY_MESSAGE } as const;

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { error: "Create your workspace first." } as const;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has ended. Sign in again." } as const;

  const list = await listDocuments();
  const row = list.ok ? list.rows.find((one) => one.id === documentId) : undefined;
  if (!row) return { error: "That document is not in this workspace." } as const;
  if (neededAction(row) !== "Sign") return { error: "This document is not waiting on a signature." } as const;

  return { workspaceId, userId: user.id, supabase, row } as const;
}

function signedReturn(): never {
  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?tab=action&signed=1`);
}

/**
 * Sign on screen — the professional's half of what the Portal's client does.
 *
 * The PDF is read from Storage here and stamped here with what was placed, so
 * what is filed is the document as it was sent, with the signature added.
 * Returns the problem rather than redirecting with it: a refused signature
 * should not throw away everything placed across the pages.
 */
export async function signDocumentOnScreen(formData: FormData): Promise<SigningResult> {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const found = await documentToSign(documentId);
  if ("error" in found) return { error: found.error as string };
  const { workspaceId, userId, supabase, row } = found;

  const fileUrl = row.file_url.trim();
  if (!isSignablePdf(fileUrl)) {
    return { error: "Only a PDF can be signed on screen. Use “Sign on paper” instead." };
  }

  const { data: original, error: downloadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(fileUrl);
  if (downloadError || !original) return { error: "The document could not be opened. Please try again." };

  const stamped = await signFromForm(formData, new Uint8Array(await original.arrayBuffer()));
  if ("error" in stamped) return { error: stamped.error };

  const stored = await storeDocumentFile(
    supabase,
    workspaceId,
    new File([new Uint8Array(stamped.bytes)], signedFileName(row.title, "pdf"), { type: "application/pdf" }),
  );
  if (!stored || "error" in stored) {
    return { error: stored?.error ?? "The signed copy could not be saved. Please try again." };
  }

  const note = String(formData.get("note") ?? "").trim() || null;
  const filed = await fileSignedVersion(supabase, {
    workspaceId,
    userId,
    documentId,
    fileUrl: stored.path,
    signer: { name: stamped.name, method: "typed", note },
  });
  if ("error" in filed) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([stored.path]);
    return { error: filed.error };
  }

  signedReturn();
}

/** Sign on paper: the copy signed in ink and scanned, filed as it arrived. */
export async function uploadSignedCopyFile(formData: FormData): Promise<SigningResult> {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const found = await documentToSign(documentId);
  if ("error" in found) return { error: found.error as string };
  const { workspaceId, userId, supabase } = found;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the signed copy to upload." };

  const stored = await storeDocumentFile(supabase, workspaceId, file);
  if (!stored || "error" in stored) {
    return { error: stored?.error ?? "Upload failed. Please try again." };
  }

  const note = String(formData.get("note") ?? "").trim() || null;
  const filed = await fileSignedVersion(supabase, {
    workspaceId,
    userId,
    documentId,
    fileUrl: stored.path,
    signer: { name: null, method: "uploaded", note },
  });
  if ("error" in filed) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([stored.path]);
    return { error: filed.error };
  }

  signedReturn();
}

/**
 * Screen 21a3 — replace an expiring document with its renewal.
 *
 * A new row rather than an edit, with the old one pointed at it through
 * `superseded_by_document_id`. §1.16 keeps the record of what was in force
 * when: overwriting the file would erase the fact that the old certificate was
 * the valid one until the day it wasn't.
 */
export async function updateDocument(formData: FormData) {
  await stopIfReadOnly();

  const documentId = String(formData.get("document_id") ?? "").trim();
  const fileUrl = String(formData.get("file_url") ?? "").trim();
  const effective = String(formData.get("effective_date") ?? "").trim();
  const expires = String(formData.get("expires_at") ?? "").trim();
  const newFile = formData.get("file");
  const hasNewFile = newFile instanceof File && newFile.size > 0;

  if (!documentId) redirect(LIST);

  const back = `${LIST}?tab=action&update=${documentId}`;
  if (!hasNewFile && !fileUrl) {
    redirect(`${back}&error=${encodeURIComponent("Drop a file here, or click to browse.")}`);
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: previous } = await supabase
    .from("documents")
    .select("id, title, context_type, context_id, visibility, version")
    .eq("id", documentId)
    .maybeSingle();

  if (!previous || !user) redirect(LIST);

  let stored = fileUrl;
  if (hasNewFile) {
    const result = await storeDocumentFile(supabase, workspaceId, newFile);
    if (result && "error" in result) {
      redirect(`${back}&error=${encodeURIComponent(result.error)}`);
    }
    if (result && "path" in result) stored = result.path;
  }

  const { data: replacement, error } = await supabase
    .from("documents")
    .insert({
      title: previous.title,
      file_url: stored,
      context_type: previous.context_type,
      context_id: previous.context_id,
      visibility: previous.visibility,
      status: "current",
      version: ((previous.version as number) ?? 1) + 1,
      effective_date: effective || null,
      // A renewed document has a new expiry, and without one it would sit in
      // Action Needed asking to be replaced again the moment it was.
      expires_at: expires || null,
      uploaded_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error || !replacement) {
    redirect(`${back}&error=${encodeURIComponent(error?.message ?? "Could not save it.")}`);
  }

  // The old version stays, marked as replaced and pointing at what replaced it.
  await supabase
    .from("documents")
    .update({
      status: "archived",
      superseded_by_document_id: replacement.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  // Labels belong to the document, so the renewal inherits them.
  const { data: labels } = await supabase
    .from("document_labels")
    .select("label_text")
    .eq("document_id", documentId);

  if (labels && labels.length > 0) {
    await supabase.from("document_labels").insert(
      labels.map((row) => ({
        document_id: replacement.id,
        label_text: row.label_text as string,
        created_by_user_id: user.id,
      })),
    );
  }

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?uploaded=${encodeURIComponent(previous.title as string)}`);
}

/**
 * Screen 12.7 — Archive, from the All-row control.
 *
 * Permanent delete is Settings → Archive, the same rule Clients, Contacts,
 * Providers and Knowledge already follow. This only sets `status: archived`.
 */
export async function archiveDocument(formData: FormData) {
  await stopIfReadOnly();

  const documentId = String(formData.get("document_id") ?? "").trim();
  if (!documentId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: document } = await supabase
    .from("documents")
    .select("id, context_type, context_id")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) redirect(LIST);

  const contextType = document.context_type as string;
  const contextId = document.context_id as string;

  if (!isUnlinkedDocument(contextType, contextId, workspaceId)) {
    const table = contextType === "client" ? "whitbyos_clients" : "whitbyos_requests";
    const { data: parent } = await supabase
      .from(table)
      .select("id")
      .eq("id", contextId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!parent) redirect(LIST);
  }

  const { error } = await supabase
    .from("documents")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", documentId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");

  const returnTo = String(formData.get("return_to") ?? "").trim();
  if (returnTo.startsWith("/whitbyos/documents")) {
    const [path, query] = returnTo.split("?");
    const params = new URLSearchParams(query);
    params.delete("remove");
    params.set("archived", "1");
    redirect(`${path}?${params.toString()}`);
  }
  redirect(`${LIST}?archived=1`);
}

/**
 * Which client a document belongs to, and which workspace.
 *
 * A document is filed against a client or a request, so the client is either
 * the context itself or the request's. Needed because a signature notice is
 * addressed to the people on that account, and a document filed against a
 * provider or nothing at all has nobody to address.
 */
async function documentClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentId: string,
  workspaceId: string,
): Promise<{ clientId: string | null; title: string } | null> {
  const { data: document } = await supabase
    .from("documents")
    .select("id, title, context_type, context_id")
    .eq("id", documentId)
    .maybeSingle();

  if (!document) return null;

  const title = (document.title as string) ?? "Document";
  const type = document.context_type as string;
  const id = document.context_id as string;

  if (type === "client") {
    const { data: client } = await supabase
      .from("whitbyos_clients")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return { clientId: client ? id : null, title };
  }

  if (type === "request") {
    const { data: request } = await supabase
      .from("whitbyos_requests")
      .select("client_id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return { clientId: (request?.client_id as string | null) ?? null, title };
  }

  return { clientId: null, title };
}

/**
 * Send a document to the client to sign — the professional's half of §14.12.
 *
 * Nothing is uploaded here. The document already exists; this records that the
 * client has been asked, which is what puts it in front of them in the Portal
 * and what the professional's own screen reads back as "Sent for signature".
 */
export async function requestSignature(formData: FormData) {
  await stopIfReadOnly();

  const documentId = String(formData.get("document_id") ?? "").trim();
  if (!documentId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const context = await documentClient(supabase, documentId, workspaceId);
  if (!context) redirect(LIST);

  if (!context.clientId) {
    redirect(
      `${LIST}?doc=${documentId}&error=${encodeURIComponent(
        "Link this document to a client or a request first. There is nobody to send it to.",
      )}`,
    );
  }

  // The client signs by placing their signature on the page, which needs a
  // PDF held in Storage. A Word file or a link would reach them as something
  // they could only download and print.
  const { data: file } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", documentId)
    .maybeSingle();

  if (!isSignablePdf(file?.file_url as string | null)) {
    redirect(
      `${LIST}?doc=${documentId}&error=${encodeURIComponent(
        "Only a PDF can be sent for signature. Upload a PDF version of this document, then send that.",
      )}`,
    );
  }

  const { error } = await supabase
    .from("documents")
    .update({
      signature_required_from: "client",
      signature_state: "awaiting",
      // Asking somebody to sign a document they cannot open is not asking. The
      // Portal shows `client_visible` rows and nothing else, so sending for
      // signature is what makes it visible — the alternative is a notice about
      // a document that is not on their screen.
      visibility: "client_visible",
      // A fresh ask clears what the last answer said, or the screen would show
      // a refusal underneath a request that has not been answered yet.
      signature_note: null,
      signature_actioned_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) redirect(`${LIST}?doc=${documentId}&error=${encodeURIComponent(error.message)}`);

  await notifyClientContacts({
    workspaceId,
    clientId: context.clientId,
    event: "action_needed",
    area: "documents",
    kind: "signature_requested",
    title: "A document needs your signature",
    body: context.title,
    href: "/client-portal/documents",
    entityType: "document",
    entityId: documentId,
  });

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${LIST}?doc=${documentId}&sent=1`);
}

/**
 * The professional's answer when the client asked *them* to sign.
 *
 * Declining is a real answer and needs saying out loud: a refusal with a
 * reason is how the other side knows what to change, and a round trip that can
 * only end in agreement is not a round trip. Signing itself still goes through
 * `resolveDocument`, which keeps the unsigned original as its own version.
 */
export async function declineSignature(formData: FormData) {
  await stopIfReadOnly();

  // `documentId` from the signing screen, which both products share.
  const documentId = String(formData.get("document_id") ?? formData.get("documentId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!documentId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const context = await documentClient(supabase, documentId, workspaceId);
  if (!context) redirect(LIST);

  const { error } = await supabase
    .from("documents")
    .update({
      signature_state: "declined",
      signature_note: note || null,
      signature_actioned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) redirect(`${LIST}?doc=${documentId}&error=${encodeURIComponent(error.message)}`);

  if (context.clientId) {
    await notifyClientContacts({
      workspaceId,
      clientId: context.clientId,
      event: "action_needed",
      area: "documents",
      kind: "signature_declined",
      title: "A document was not signed",
      body: note ? `${context.title}: ${note}` : context.title,
      href: "/client-portal/documents",
      entityType: "document",
      entityId: documentId,
    });
  }

  revalidatePath("/[product]/[[...slug]]", "page");
  redirect(`${LIST}?doc=${documentId}&declined=1`);
}

/**
 * §12's "link a Document to a Request", after the upload.
 *
 * Creation has always been able to file a document against a Request; nothing
 * could change it afterwards, so a file put in the wrong place — or filed
 * before the Request existed, which is the common way round — stayed there.
 *
 * Only a Request of the client the document already belongs to, and only that
 * client's own: moving paperwork between families is not an edit, it is an
 * accident waiting in a dropdown.
 */
export async function linkDocumentToRequest(formData: FormData) {
  await stopIfReadOnly();

  const documentId = String(formData.get("document_id") ?? "").trim();
  const requestId = String(formData.get("request_id") ?? "").trim();
  const back = String(formData.get("back") ?? "/whitbyos/documents");
  if (!documentId) redirect(back);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(back);

  const supabase = await createClient();
  const openClient = await getOpenClientId();

  if (requestId) {
    const { data: request } = await supabase
      .from("whitbyos_requests")
      .select("id, client_id")
      .eq("id", requestId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!request) redirect(back);
    if (openClient && request.client_id !== openClient) redirect(back);

    await supabase
      .from("documents")
      .update({ context_type: "request", context_id: requestId })
      .eq("id", documentId);
  } else {
    // Off the Request and back onto the client it belongs to, which is where
    // an unlinked document lives.
    await supabase
      .from("documents")
      .update({ context_type: "client", context_id: openClient ?? workspaceId })
      .eq("id", documentId);
  }

  revalidatePath(ROUTE, "page");
  redirect(back);
}
