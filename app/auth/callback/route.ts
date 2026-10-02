import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { ensureBaseAccount } from "@/base/identity/bootstrap";
import { findActiveAccountsByEmail } from "@/base/identity/lookupAccountByEmail";
import { EMAIL_ALREADY_REGISTERED_MESSAGE, normalizeEmail } from "@/base/lib/email";
import { postAuthPath, siteUrl } from "@/base/auth/site";
import {
  isClientAudience,
  isGenericPostAuthNext,
  resolvePostAuthLanding,
} from "@/base/auth/landing";
import { isPartnerNext, partnerSignInHref } from "@/base/auth/query";
import { whitbyEntryPath } from "@/base/switcher/products";
import type { EmailOtpType } from "@supabase/supabase-js";
import {
  resolveReferralAttributionFromCookie,
  createPartnerReferralOnSignup,
  isNewSignupUser,
} from "@/partner-center/lib/referral-capture";
import { isSharedReferralDestination } from "@/partner-center/lib/referral-url";

function loginPath(next: string) {
  return isPartnerNext(next) ? partnerSignInHref() : "/login";
}

function confirmPath(next: string) {
  return isPartnerNext(next) ? "/partner-center/confirmed" : "/confirmed";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") || postAuthPath(type);
  const origin = siteUrl();
  const login = new URL(loginPath(next), origin);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(login);
  }

  // A provider that refuses sends the reason back here as ?error=..., with no
  // code to exchange. Falling through meant redirecting to a signed-in page,
  // which the middleware bounced straight back to /login: the sign-in looked
  // like an endless redirect and never said why. Say why.
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError && !code && !tokenHash) {
    const failed = new URL(loginPath(next), origin);
    failed.searchParams.set("error", providerError);
    return NextResponse.redirect(failed);
  }

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failed = new URL(
        type === "recovery" || next.startsWith("/reset-password") || next.startsWith("/partner-center/reset-password")
          ? loginPath(next)
          : confirmPath(next),
        origin,
      );
      failed.searchParams.set("error", error.message);
      return NextResponse.redirect(failed);
    }
  } else if (tokenHash && type === "recovery") {
    /**
     * A recovery token is spent the first time it is used, and a GET is not
     * proof that a person did the using.
     *
     * Mail hosts and corporate scanners fetch the links in a message before
     * anybody opens it, and that fetch used to redeem the token: by the time
     * the recipient clicked, the link was "expired", and forwarding it to
     * somebody else was guaranteed to fail. Verifying it here also signed the
     * visitor in, so opening a reset link put you in the product rather than
     * in front of a password field.
     *
     * So it is carried through to the form and spent there, by a POST, which
     * no scanner makes.
     */
    const reset = new URL("/reset-password", origin);
    reset.searchParams.set("token_hash", tokenHash);
    return NextResponse.redirect(reset);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      const failed = new URL(
        type === "recovery" ? loginPath(next) : confirmPath(next),
        origin,
      );
      failed.searchParams.set("error", error.message);
      return NextResponse.redirect(failed);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const email = normalizeEmail(user.email);
    if (email) {
      const accounts = await findActiveAccountsByEmail(email);
      const other = accounts.find((account) => account.id !== user.id);
      if (other) {
        await supabase.auth.signOut();
        const taken = new URL(loginPath(next), origin);
        taken.searchParams.set("error", EMAIL_ALREADY_REGISTERED_MESSAGE);
        return NextResponse.redirect(taken);
      }
    }

    try {
      await ensureBaseAccount(supabase, user);
    } catch {
      // Account rows may already exist from a previous visit.
    }

    try {
      const attribution = resolveReferralAttributionFromCookie(await cookies());
      if (attribution) {
        await createPartnerReferralOnSignup({
          userId: user.id,
          email: user.email ?? "",
          fullName: user.user_metadata?.full_name as string | undefined,
          referralCode: attribution.code,
          capturedAt: attribution.capturedAt,
          program: attribution.program,
          shared:
            attribution.shared === true ||
            (!attribution.program && isSharedReferralDestination(next)),
          isNewSignup: isNewSignupUser(user.created_at),
        });
      }
    } catch {
      // Referral attribution must never block auth callback.
    }

    // Its own try, not the referral's. The merge that lost the block above put
    // this one in its place inside the same catch, where either failing would
    // have swallowed the other.
    try {
      const { createAdminClient, isSupabaseAdminConfigured } = await import(
        "@/base/lib/supabase/admin"
      );
      if (isSupabaseAdminConfigured() && user.email) {
        const admin = createAdminClient();
        const { data: pendingInvite } = await admin
          .from("invitations")
          .select("token")
          .eq("invitee_email", email)
          .eq("context_type", "academy_instructor")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingInvite?.token) {
          await admin.rpc("academy_accept_instructor_invitation", {
            p_token: pendingInvite.token,
            p_user_id: user.id,
          });
          return NextResponse.redirect(new URL("/academy/instructor", origin));
        }
      }
    } catch {
      // Pending instructor invite completion is best-effort on auth callback.
    }

    // Partner Center Company & Team invites must finish on
    // /partner-center/invite/<token>. If the email link dropped the token and
    // landed on switcher/confirmed, recover from the pending invitation row.
    try {
      const { createAdminClient, isSupabaseAdminConfigured } = await import(
        "@/base/lib/supabase/admin"
      );
      if (isSupabaseAdminConfigured() && email) {
        const admin = createAdminClient();
        const { data: pendingTeamInvite } = await admin
          .from("invitations")
          .select("token, expires_at")
          .eq("invitee_email", email)
          .eq("context_type", "partner_team")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const token = pendingTeamInvite?.token as string | undefined;
        const expired =
          pendingTeamInvite?.expires_at &&
          new Date(pendingTeamInvite.expires_at as string).getTime() < Date.now();
        const isRecovery =
          type === "recovery" ||
          next.startsWith("/reset-password") ||
          next.startsWith("/partner-center/reset-password");
        if (token && !expired && !isRecovery && !next.startsWith("/partner-center/invite/")) {
          return NextResponse.redirect(
            new URL(`/partner-center/invite/${token}`, origin),
          );
        }
      }
    } catch {
      // Pending partner team invite recovery is best-effort on auth callback.
    }

    // Partner Admin invite Accept → admin shell, never the product switcher.
    // Keep /partner-center/admin/signup?token=… intact so they can set a
    // password first (same idea as /partner-center/invite/<token>).
    try {
      const isRecovery =
        type === "recovery" ||
        next.startsWith("/reset-password") ||
        next.startsWith("/partner-center/reset-password") ||
        next.startsWith("/partner-center/admin/reset-password");
      const isAdminSignup =
        next === "/partner-center/admin/signup" ||
        next.startsWith("/partner-center/admin/signup?");
      if (!isRecovery && !isAdminSignup && user.email) {
        const { resolvePartnerAdminPostAuthLanding } = await import(
          "@/partner-center/admin/lib/invite"
        );
        const adminLanding = await resolvePartnerAdminPostAuthLanding({
          userId: user.id,
          email: user.email,
        });
        if (adminLanding) {
          return NextResponse.redirect(new URL(adminLanding, origin));
        }
      }
    } catch {
      // Partner Admin divert is best-effort on auth callback.
    }
  }

  let destination = postAuthPath(type, next.startsWith("/") ? next : undefined);
  if (next.startsWith("/reset-password") || type === "recovery") {
    destination = "/reset-password";
  } else if (next.startsWith("/onboarding")) {
    destination = "/switcher";
  } else if (next.startsWith("/") && next !== "/switcher") {
    destination = next;
  } else if (
    destination === "/switcher" &&
    type !== "recovery" &&
    user?.email_confirmed_at &&
    Date.now() - new Date(user.email_confirmed_at).getTime() < 10 * 60 * 1000
  ) {
    destination = "/confirmed";
  }

  // Generic destinations (switcher / academy home) upgrade to the right surface:
  // client portal, Academy staff, or Academy-branded learner home.
  // Clients must never land on Whitby's organisation overview.
  if (isGenericPostAuthNext(destination)) {
    destination = await resolvePostAuthLanding(supabase, user?.id, destination);
  }
  if (destination !== "/confirmed") {
    destination = whitbyEntryPath(destination);
  }
  const client = user ? await isClientAudience(user.id, user.email) : false;
  if (client && destination.startsWith("/whitbyos")) destination = "/switcher";

  return NextResponse.redirect(new URL(destination, origin));
}
