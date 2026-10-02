import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { emailConfirmRedirect, getConfiguredClient, jsonError, missingConfig, siteUrl } from "@/base/auth/http";
import { isAcademyNext, isPartnerNext } from "@/base/auth/query";
import { ensureBaseAccount } from "@/base/identity/bootstrap";
import { emailHasActiveAccount } from "@/base/identity/lookupAccountByEmail";
import {
  EMAIL_ALREADY_REGISTERED,
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  isPlausibleEmail,
  mapSignupAuthError,
  normalizeEmail,
} from "@/base/lib/email";
import {
  resolveReferralAttributionFromCookie,
  createPartnerReferralOnSignup,
} from "@/partner-center/lib/referral-capture";
import { isSharedReferralDestination } from "@/partner-center/lib/referral-url";

export async function POST(request: Request) {
  const supabase = await getConfiguredClient();
  if (!supabase) return missingConfig();

  const body = (await request.json()) as {
    fullName?: string;
    email?: string;
    password?: string;
    next?: string;
    brand?: string;
    role?: string;
  };

  // Public signup never grants instructor/admin. Ignore any client-supplied role.
  void body.role;

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!fullName || !email || !password) {
    return jsonError("Full Name, Email Address, and Password are required.");
  }
  if (!isPlausibleEmail(email)) {
    return jsonError("Enter a valid email address.");
  }

  if (await emailHasActiveAccount(email)) {
    return jsonError(EMAIL_ALREADY_REGISTERED_MESSAGE, 409, EMAIL_ALREADY_REGISTERED);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: isAcademyNext(body.next)
        ? `${siteUrl()}/auth/callback?next=/academy`
        : isPartnerNext(body.next)
          ? `${siteUrl()}/auth/callback?next=/partner-center/confirmed`
          : isSharedReferralDestination(body.next, body.brand)
            ? `${siteUrl()}/auth/callback?next=/switcher`
            : emailConfirmRedirect(),
    },
  });

  if (error) {
    const mapped = mapSignupAuthError(error.message);
    const status = mapped.code === EMAIL_ALREADY_REGISTERED ? 409 : 400;
    return jsonError(mapped.message, status, mapped.code);
  }

  // Create referral as soon as Auth returns a user — including the common
  // email-confirm path where `session` is null. Waiting until /auth/callback
  // drops attribution if the confirm link opens without the cookie.
  if (data.user) {
    try {
      await ensureBaseAccount(supabase, {
        id: data.user.id,
        email: data.user.email,
        user_metadata: { full_name: fullName },
      });
    } catch {
      // Continue even if a workspace already exists.
    }
    try {
      const attribution = resolveReferralAttributionFromCookie(await cookies());
      if (attribution) {
        // Signup URL wins over a leftover academy/whitbyos cookie from an
        // earlier click — shared switcher signup must open Platform.
        const sharedDestination = isSharedReferralDestination(
          body.next,
          body.brand,
        );
        await createPartnerReferralOnSignup({
          userId: data.user.id,
          email,
          fullName: body.fullName,
          referralCode: attribution.code,
          capturedAt: attribution.capturedAt,
          program: sharedDestination ? undefined : attribution.program,
          shared:
            sharedDestination ||
            attribution.shared === true ||
            !attribution.program,
          isNewSignup: true,
        });
      }
    } catch {
      // Referral attribution must never block signup.
    }
  }

  if (!data.session) {
    const encoded = encodeURIComponent(email);
    if (isPartnerNext(body.next)) {
      return NextResponse.json({
        redirect: `/partner-center/check-email?email=${encoded}`,
      });
    }
    return NextResponse.json({
      redirect: `/check-email?email=${encoded}`,
    });
  }

  return NextResponse.json({ redirect: body.next || "/switcher" });
}
