import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";

export function missingConfig() {
  return NextResponse.json(
    {
      error:
        "Supabase is not connected yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue.",
    },
    { status: 503 },
  );
}

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      message,
      ...(code ? { code } : {}),
    },
    { status },
  );
}

export async function getConfiguredClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient();
}

export { PRODUCTION_HOST, emailConfirmRedirect, passwordResetRedirect, postAuthPath, requestOrigin, siteUrl } from "@/base/auth/site";
