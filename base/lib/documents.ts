import type { SupabaseClient } from "@supabase/supabase-js";

const DOCUMENTS_BUCKET = "documents";

/**
 * `documents.file_url` holds two different things depending on who filed the
 * row: an external link (WhitbyOS's upload flow — SRS 14.12, there is no
 * native file storage on that side, so it records wherever the file already
 * lives, e.g. Dropbox or an emailed copy) or a private Storage object path
 * (the Client Portal's upload flow, which does put the file in the `documents`
 * bucket). One column, two shapes, so opening a document has to tell them
 * apart rather than assume either one.
 */
export function isInboxLink(fileUrl: string) {
  const value = fileUrl.trim();
  if (!value) return false;
  if (/^mailto:/i.test(value)) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "mail.google.com" || host === "gmail.com") return true;
    if (host === "google.com" && url.pathname.toLowerCase().startsWith("/gmail")) return true;
    if (
      host === "outlook.live.com" ||
      host === "outlook.office.com" ||
      host === "outlook.office365.com"
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function resolveDocumentUrl(
  supabase: SupabaseClient,
  fileUrl: string,
  /** Ask the browser to save it rather than render it in a tab. */
  download = false,
): Promise<string | null> {
  // An inbox URL is not a file. Returning it made Download replace the app
  // with Gmail. The caller shows an error instead of navigating there.
  if (isInboxLink(fileUrl)) return null;
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(fileUrl, 60, download ? { download: true } : undefined);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
