import { NextResponse } from "next/server";
import { createClient } from "@/base/lib/supabase/server";
import { isInboxLink } from "@/base/lib/documents";
import { DOCUMENTS_BUCKET } from "@/whitbyos/lib/document-storage";
import { getDocument } from "@/whitbyos/lib/documents";

export const dynamic = "force-dynamic";

/**
 * Screen 12.3 / 21a's Download.
 *
 * A server action `redirect()` to `file_url` opened Gmail when the stored
 * value was a mail link, and navigated the tab away even for a real file.
 * This route reads the object (or refuses an inbox URL) and returns it with
 * Content-Disposition: attachment so the browser saves it and stays here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/whitbyos/documents");
    return NextResponse.redirect(login);
  }

  const document = await getDocument(id);
  if (!document) {
    return back(request, "That document is not in this workspace.");
  }

  const fileUrl = document.file_url.trim();
  if (!fileUrl) {
    return back(request, "This document has no file to download yet.");
  }

  if (isInboxLink(fileUrl)) {
    return back(
      request,
      "This is a Gmail link, not a file. Save the document (PDF, Word, or image) and upload that, then Download will work.",
    );
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    return NextResponse.redirect(fileUrl);
  }

  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(fileUrl);
  if (error || !data) {
    return back(request, "Could not open that file. Please try again.");
  }

  const filename = downloadName(fileUrl, document.title);
  const bytes = await data.arrayBuffer();

  return new Response(bytes, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function downloadName(path: string, title: string) {
  const stored = path.split("/").pop() ?? "";
  const withoutTime = stored.replace(/^\d+-/, "");
  const raw = withoutTime || title || "document";
  const safe = raw.replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe.slice(0, 80) || "document";
}

function back(request: Request, error: string) {
  const referer = request.headers.get("referer");
  const url =
    referer && referer.includes("/whitbyos/documents")
      ? new URL(referer)
      : new URL("/whitbyos/documents", request.url);
  url.searchParams.delete("sign");
  url.searchParams.delete("update");
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}
