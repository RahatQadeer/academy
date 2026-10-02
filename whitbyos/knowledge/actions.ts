"use server";

import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { stopIfReadOnly } from "@/whitbyos/lib/read-only";

const LIST = "/whitbyos/knowledge";
const ROUTE = "/[product]/[[...slug]]";
const BUCKET = "documents";

function backWithError(message: string): never {
  redirect(`${LIST}?new=1&error=${encodeURIComponent(message)}`);
}

/**
 * Screens 13.2 and 13.2b — New File, written or uploaded.
 *
 * One row either way: `body_or_file_url` is one column because a Knowledge file
 * is one thing to whoever reads it, and `type` says which kind it is. An upload
 * goes to the private documents bucket and is kept as a signed URL, the same
 * way message attachments are.
 */
export async function createKnowledgeFile(formData: FormData) {
  await stopIfReadOnly();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const scope = String(formData.get("scope") ?? "organization").trim();
  const body = String(formData.get("body") ?? "").trim();
  const file = formData.get("file");

  if (!title) backWithError("Give the file a title.");

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) backWithError("Create your workspace first.");

  const supabase = await createClient();

  let type = "write";
  let content = body;

  if (file instanceof File && file.size > 0) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `knowledge/${workspaceId}/${crypto.randomUUID()}-${safe}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false });

    if (uploadError) backWithError(`Could not upload ${file.name}: ${uploadError.message}`);

    // A year, because it hangs on a list that is read for as long as the file
    // is useful — the bucket is private, so there is no unsigned URL to keep.
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    type = "upload";
    content = signed?.signedUrl ?? path;
  }

  if (!content) backWithError("Write something, or choose a file to upload.");

  const { data, error } = await supabase
    .from("whitbyos_knowledge")
    .insert({
      workspace_id: workspaceId,
      title,
      category: category || null,
      scope: scope === "client" ? "client" : "organization",
      // Whose it is, where it is one client's. An organization file belongs to
      // the practice and carries no client.
      client_id: scope === "client" ? await getOpenClientId() : null,
      type,
      body_or_file_url: content,
      status: "current",
    })
    .select("id")
    .single();

  if (error || !data) backWithError(error?.message ?? "Could not save the file.");

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}/${data.id}?created=1`);
}

/** 13.1's Edit — a written file's own text. */
export async function updateKnowledgeFile(formData: FormData) {
  await stopIfReadOnly();

  const fileId = String(formData.get("file_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const scope = String(formData.get("scope") ?? "organization").trim();
  const body = String(formData.get("body") ?? "").trim();

  const back = `${LIST}/${fileId}`;
  if (!fileId) redirect(LIST);
  if (!title) redirect(`${back}?edit=1&error=${encodeURIComponent("A file needs a title.")}`);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("whitbyos_knowledge")
    .select("type, body_or_file_url")
    .eq("id", fileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!current) redirect(LIST);

  const { error } = await supabase
    .from("whitbyos_knowledge")
    .update({
      title,
      category: category || null,
      scope: scope === "client" ? "client" : "organization",
      // Whose it is, where it is one client's. An organization file belongs to
      // the practice and carries no client.
      client_id: scope === "client" ? await getOpenClientId() : null,
      // An uploaded file's content is the file. Editing its text would replace
      // a link to the document with whatever was typed over it.
      body_or_file_url: current.type === "upload" ? current.body_or_file_url : body,
      updated_at: new Date().toISOString(),
    })
    .eq("id", fileId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${back}?edit=1&error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${back}?saved=1`);
}

/** 13.3's first answer — out of the Library, still in Settings → Archive. */
export async function archiveArticle(formData: FormData) {
  await stopIfReadOnly();

  const articleId = String(formData.get("article_id") ?? "").trim();
  if (!articleId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_knowledge")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", articleId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?archived=1`);
}

/**
 * 13.3's second — "removes the article and its content for good".
 *
 * An article owns nothing else, so there is no cascade to run: its body or its
 * uploaded file is the whole of it. The file goes with it, because a Storage
 * object nothing points at is a file nobody can reach and nobody can delete.
 */
export async function deleteArticle(formData: FormData) {
  await stopIfReadOnly();

  const articleId = String(formData.get("article_id") ?? "").trim();
  if (!articleId) redirect(LIST);

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) redirect(LIST);

  const supabase = await createClient();

  const { data: article } = await supabase
    .from("whitbyos_knowledge")
    .select("type, body_or_file_url")
    .eq("id", articleId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!article) redirect(LIST);

  const stored = String(article.body_or_file_url ?? "");
  if (article.type === "file" && stored && !/^https?:\/\//i.test(stored)) {
    await supabase.storage.from("documents").remove([stored]);
  }

  const { error } = await supabase
    .from("whitbyos_knowledge")
    .delete()
    .eq("id", articleId)
    .eq("workspace_id", workspaceId);

  if (error) redirect(`${LIST}?error=${encodeURIComponent(error.message)}`);

  revalidatePath(ROUTE, "page");
  redirect(`${LIST}?removed=1`);
}
