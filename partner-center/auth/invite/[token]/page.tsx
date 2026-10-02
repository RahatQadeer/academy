import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { describeInvitation, findInvitationByToken } from "@/base/auth/invitation";
import { Callout } from "@/base/components/Callout";
import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerInviteAcceptView } from "@/partner-center/auth/components/PartnerInviteAcceptView";
import { decodePartnerTeamInvite } from "@/partner-center/team/lib/invite-payload";
import { functionLabel } from "@/partner-center/team/lib/labels";

export default async function PartnerInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <PartnerAuthLayout title="Invitation">
        <Callout tone="warning">
          Connect Supabase to load invitations. Token: {token}
        </Callout>
      </PartnerAuthLayout>
    );
  }

  const invitation = await findInvitationByToken(token);

  if (!invitation || invitation.context_type !== "partner_team") {
    return (
      <PartnerAuthLayout title="Invitation" backHref="/partner-center/signin">
        <Callout tone="danger">This invitation is not valid.</Callout>
      </PartnerAuthLayout>
    );
  }

  const expired = invitation.expires_at
    ? new Date(invitation.expires_at).getTime() < Date.now()
    : false;

  // Returning invitees who already accepted: skip the form and any warning.
  if (invitation.status === "accepted") {
    const session = await getSessionProfile();
    const sessionEmail = session?.user.email?.trim().toLowerCase() ?? "";
    const inviteEmail = invitation.invitee_email.trim().toLowerCase();
    if (sessionEmail && sessionEmail === inviteEmail) {
      redirect("/partner-center");
    }
  }

  const { inviterName } = await describeInvitation(invitation);
  const decoded = decodePartnerTeamInvite(invitation.role_or_relationship);
  const role = functionLabel(decoded?.function ?? "referral_contact");

  return (
    <PartnerInviteAcceptView
      token={token}
      email={invitation.invitee_email}
      inviteeName={invitation.invitee_name}
      inviterName={inviterName}
      role={role}
      expired={expired}
      status={invitation.status}
    />
  );
}
