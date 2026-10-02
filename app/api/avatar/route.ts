import { createClient } from "@/base/lib/supabase/server";

/**
 * A person's photo, served from this origin.
 *
 * Avatars do not all come from the same place. A photo somebody uploads lands
 * in Supabase storage and comes back as a signed URL; a photo that arrives with
 * a Google sign-in is a googleusercontent link, and Google refuses plenty of
 * those when a browser asks for them from somewhere else — the request
 * succeeds from a server and fails on the page, which is exactly the shape of
 * bug nobody can see.
 *
 * So the page asks us and we ask them. Same origin, one referrer policy, and
 * no third party told which of a private-client firm's screens are being
 * looked at.
 *
 * A failure is a transparent pixel rather than a status, because the avatar
 * draws the person's initials underneath and a broken image would put Chrome's
 * torn-page glyph over the top of them.
 */

// 1×1 transparent GIF.
const BLANK = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function blank() {
  return new Response(new Uint8Array(BLANK), {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return blank();

  // Signed in only, and the URL is looked up rather than passed in — an open
  // image proxy is somebody else's outbound request with our name on it.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return blank();

  const { data } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", id)
    .maybeSingle();

  const url = data?.avatar_url as string | null;
  if (!url || !/^https:\/\//.test(url)) return blank();

  try {
    const upstream = await fetch(url, {
      headers: { Accept: "image/*" },
      referrer: "",
      signal: AbortSignal.timeout(5_000),
    });

    if (!upstream.ok) return blank();

    const type = upstream.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return blank();

    return new Response(upstream.body, {
      headers: {
        "Content-Type": type,
        // An hour: long enough that a page of thirty avatars costs one request,
        // short enough that changing your photo shows up the same day.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return blank();
  }
}
