import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/base/identity/session";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerSignupForm } from "@/partner-center/auth/components/PartnerSignupForm";
import { partnerTeamInvitePath } from "@/partner-center/lib/invite-url";
import { findPendingPartnerTeamInviteToken } from "@/partner-center/lib/pending-team-invite";
import { resolvePartner } from "@/partner-center/lib/resolve-partner";

export default async function PartnerApplyPage() {
  if (isSupabaseConfigured()) {
    const session = await getSessionProfile();
    if (session) {
      // Company & Team invitees use /partner-center/invite/[token], not Apply.
      const inviteToken = await findPendingPartnerTeamInviteToken(
        session.user.email,
      );
      if (inviteToken) redirect(partnerTeamInvitePath(inviteToken));

      const context = await resolvePartner(
        session.user,
        session.entitlements,
      );
      if (context?.teamMember) redirect("/partner-center");

      redirect("/partner-center/onboarding");
    }
  }

  return (
    <PartnerAuthLayout
      title="Apply to the Partner Program"
      description="Create your Private Attaché identity, then tell us about your business. Applications are reviewed before Partner Center opens."
      footer={
        <p className="text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
          Already a partner?{" "}
          <Link href="/partner-center/signin" className="font-medium">
            Sign in to Partner Center
          </Link>
        </p>
      }
    >
      <PartnerSignupForm />
    </PartnerAuthLayout>
  );
}

