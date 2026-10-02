import { NextResponse } from "next/server";
import { getConfiguredClient, jsonError, missingConfig } from "@/base/auth/http";
import { resolvePostAuthLanding } from "@/base/auth/landing";

export async function POST(request: Request) {
  const supabase = await getConfiguredClient();
  if (!supabase) return missingConfig();

  const body = (await request.json()) as { password?: string; token_hash?: string };
  if (!body.password) return jsonError("Password is required.");

  /**
   * Redeem the emailed token here, not when the link was opened.
   *
   * The callback used to verify it on the GET, which meant any mail scanner
   * that fetched the link spent it before the person clicked — so the
   * recipient saw "expired", and a link forwarded to somebody else never
   * worked at all. It also signed the visitor in, so opening a reset link put
   * them in the product instead of in front of a password field.
   *
   * A POST is not something a scanner makes. The token is spent by the person
   * actually setting a password, which is the only moment it should be.
   */
  /**
   * Only where there is not already a session.
   *
   * `verifyOtp` spends the token and opens a session. If the password is then
   * refused — too short, or the same as the old one — the token is gone, and
   * sending the form again spends nothing because there is nothing left to
   * spend: the second attempt failed as "no longer valid" and the person had
   * to go and ask for a whole new email to fix a typo.
   *
   * The session from the first attempt is enough for the second.
   */
  const {
    data: { user: already },
  } = await supabase.auth.getUser();

  if (body.token_hash && !already) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: body.token_hash,
      type: "recovery",
    });

    if (verifyError) {
      // Supabase says the same thing for spent and for stale, and the two are
      // different problems with different answers.
      return jsonError(
        "This reset link is no longer valid — it may already have been used, or it may have expired. Ask for a new one from Forgot password.",
      );
    }
  }

  const { data: updated, error } = await supabase.auth.updateUser({ password: body.password });
  if (error) {
    // No token and no session: they arrived at this page without a live link.
    if (!body.token_hash && !already) {
      return jsonError(
        "Open the link from your reset email first, then set the new password on the page it takes you to.",
      );
    }
    return jsonError(error.message);
  }

  // An invited client sets a password and is in the portal, not in front of a
  // menu of four products, three of which are not theirs. Academy instructors
  // / admins land in their Academy surface. Professionals get Figma 3.3, then
  // sign in again.
  const landing = await resolvePostAuthLanding(supabase, updated?.user?.id, "/switcher");
  return NextResponse.json({
    redirect: landing === "/switcher" ? "/password-updated" : landing,
  });
}
