import { NextResponse } from "next/server";
import { getConfiguredClient, jsonError, missingConfig } from "@/base/auth/http";
import { isClientAudience, resolvePostAuthLanding } from "@/base/auth/landing";
import { ensureBaseAccount } from "@/base/identity/bootstrap";
import {
  ACCOUNT_UNAVAILABLE,
  ACCOUNT_UNAVAILABLE_MESSAGE,
  canLoginWithStatus,
  normalizeEmail,
} from "@/base/lib/email";
import { whitbyEntryPath } from "@/base/switcher/products";

export async function POST(request: Request) {
  const supabase = await getConfiguredClient();
  if (!supabase) return missingConfig();

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    next?: string;
    brand?: string;
    role?: string;
  };

  void body.role;

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return jsonError("Email Address and password are required.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return jsonError(error.message, 401);

  if (data.user) {
    const { data: account } = await supabase
      .from("users")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (account && !canLoginWithStatus(account.status)) {
      await supabase.auth.signOut();
      return jsonError(ACCOUNT_UNAVAILABLE_MESSAGE, 403, ACCOUNT_UNAVAILABLE);
    }

    try {
      await ensureBaseAccount(supabase, data.user);
    } catch {
      // Account rows may already exist from a previous visit.
    }

    await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);
  }

  // Screen 1.2 — the password was right, and for somebody with an
  // authenticator that is only half of it.
  //
  // Supabase hands back a session either way, at assurance level 1. That
  // session can already read their data, so this is not the thing keeping them
  // out — the middleware is. This only decides where they land.
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // Academy-branded sign-in always carries Academy intent, even when `next`
  // was omitted — otherwise learners fall through to the product switcher.
  const requestedNext =
    body.next || (body.brand === "academy" ? "/academy" : "");
  const requested = requestedNext ? whitbyEntryPath(requestedNext) : "";
  const client = await isClientAudience(data?.user?.id, data?.user?.email);

  // Invited clients sign in to the switcher, which sends a portal-only client
  // straight on to Client Portal.
  // A leftover `next=/whitbyos/...` must not dump them on the organisation page.
  const landing =
    client && (!requested || requested.startsWith("/whitbyos"))
      ? "/switcher"
      : await resolvePostAuthLanding(supabase, data?.user?.id, requestedNext);

  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
    return NextResponse.json({
      redirect: `/verify?next=${encodeURIComponent(landing)}`,
    });
  }

  return NextResponse.json({ redirect: landing });
}
