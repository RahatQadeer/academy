import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerLoginForm } from "@/partner-center/auth/components/PartnerLoginForm";
import { partnerTeamInvitePath } from "@/partner-center/lib/invite-url";
import { findPendingPartnerTeamInviteToken } from "@/partner-center/lib/pending-team-invite";

export default async function PartnerSignInPage({
  error,
}: {
  error?: string;
}) {
  if (isSupabaseConfigured()) {
    const session = await getSessionProfile();
    if (session) {
      const inviteToken = await findPendingPartnerTeamInviteToken(
        session.user.email,
      );
      if (inviteToken) redirect(partnerTeamInvitePath(inviteToken));
      redirect("/partner-center");
    }
  }

  return (
    <PartnerAuthLayout
      title="Sign in"
      description="One Private Attaché identity across Partner Center and every product you are entitled to."
      footer={
        <p className="text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          New partner?{" "}
          <Link href="/partner-center/apply" className="font-medium">
            Apply to the Partner Program
          </Link>
        </p>
      }
    >
      {error ? (
        <p className="mb-4 text-[13.5px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      <PartnerLoginForm />
    </PartnerAuthLayout>
  );
}
