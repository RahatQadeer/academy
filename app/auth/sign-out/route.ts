import { NextResponse } from "next/server";
import { getConfiguredClient, missingConfig, siteUrl } from "@/base/auth/http";

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

/*
 * A link, as well as a form.
 *
 * Two places already pointed an anchor at this — Security's "Log out" and the
 * redirect a closed portal performs — and a POST-only route answers an anchor
 * with 405. Signing out is not a destructive act to guard against being
 * triggered by a link: the worst a stray GET can do is what the person can do
 * themselves in one click.
 */
export async function GET(request: Request) {
  return POST(request);
}

export async function POST(request: Request) {
  const supabase = await getConfiguredClient();
  if (!supabase) return missingConfig();
  await supabase.auth.signOut();

  const form =
    request.method === "POST" ? await request.formData().catch(() => null) : null;
  const fromForm = form ? safeNext(String(form.get("next") ?? "")) : null;
  const fromQuery = safeNext(new URL(request.url).searchParams.get("next"));
  const next = fromForm || fromQuery || "/login";

  return NextResponse.redirect(new URL(next, siteUrl()), { status: 302 });
}
