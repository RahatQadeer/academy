import { NextResponse } from "next/server";
import { getConfiguredClient, jsonError, missingConfig, passwordResetRedirect } from "@/base/auth/http";

export async function POST(request: Request) {
  const supabase = await getConfiguredClient();
  if (!supabase) return missingConfig();

  const body = (await request.json()) as { email?: string };
  if (!body.email) return jsonError("Email Address is required.");

  const { error } = await supabase.auth.resetPasswordForEmail(body.email, {
    redirectTo: passwordResetRedirect(),
  });

  if (error) return jsonError(error.message);
  return NextResponse.json({ ok: true });
}
