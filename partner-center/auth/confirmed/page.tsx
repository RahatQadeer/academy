import { Button } from "@/base/components/Button";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { partnerTeamInvitePath } from "@/partner-center/lib/invite-url";
import { findPendingPartnerTeamInviteToken } from "@/partner-center/lib/pending-team-invite";

export default async function PartnerConfirmedPage({
  error,
}: {
  error?: string;
}) {
  let signedIn = false;
  let continueHref = "/partner-center/signin";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
    if (user) {
      const inviteToken = await findPendingPartnerTeamInviteToken(user.email);
      continueHref = inviteToken
        ? partnerTeamInvitePath(inviteToken)
        : "/partner-center/onboarding";
    }
  }

  if (error) {
    return (
      <PartnerAuthLayout title="Could not confirm">
        <p
          className="mb-6 text-[16px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {error}
        </p>
        <Button href="/partner-center/signin" variant="primary" fullWidth>
          Back to sign in
        </Button>
      </PartnerAuthLayout>
    );
  }

  return (
    <PartnerAuthLayout title="Account confirmed">
      <p
        className="mb-6 text-[16px] leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        Your email is confirmed. You can continue into Partner Center.
      </p>
      <Button
        href={signedIn ? continueHref : "/partner-center/signin"}
        variant="primary"
        fullWidth
      >
        {signedIn ? "Continue" : "Sign in"}
      </Button>
    </PartnerAuthLayout>
  );
}
