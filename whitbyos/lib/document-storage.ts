import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedDocumentFile } from "@/whitbyos/lib/document-vocab";

export const DOCUMENTS_BUCKET = "documents";

/** 25MB — what 12.2 and 12.6 draw on the dropzone. */
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/**
 * Put a file in the documents bucket and hand back the path it went to.
 *
 * `documents.file_url` has always held two shapes — an external link, or a
 * Storage object path — and `resolveDocumentUrl` already tells them apart. This
 * is what finally lets the Whitby side write the second one: the bucket and the
 * Client Portal's upload have existed all along, and only this end was still
 * asking somebody to paste a link to a file they were holding.
 *
 * Scoped by workspace so one firm's files cannot be guessed at from another's
 * paths, and prefixed with the time so re-uploading the same filename does not
 * overwrite what is already filed.
 */
export async function storeDocumentFile(
  supabase: SupabaseClient,
  workspaceId: string,
  file: unknown,
): Promise<{ path: string } | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "That file is over 25MB. Choose a smaller copy." };
  }
  if (!isAllowedDocumentFile(file)) {
    return {
      error:
        "Use a PDF, Word, Excel, PNG, or JPG file. A Gmail window or browser shortcut cannot be filed.",
    };
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "document";
  const path = `${workspaceId}/${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });

  if (error) return { error: error.message };
  return { path };
}
