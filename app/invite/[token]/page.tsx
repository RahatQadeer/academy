import Link from "next/link";
import { AuthLayout } from "@/base/components/AuthLayout";
import { InviteAcceptForm } from "@/base/auth/InviteAcceptForm";
import { InvitePanel } from "@/base/auth/panels";
import { isSupabaseConfigured } from "@/base/lib/supabase/server";
import { describeInvitation, findInvitationByToken } from "@/base/auth/invitation";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { ROLE_LABELS } from "@/whitbyos/lib/settings-vocab";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <AuthLayout title="Invitation">
        <Callout tone="warning">
          Connect Supabase to load invitations. Token: {token}
        </Callout>
      </AuthLayout>
    );
  }

  // Read with the token rather than a session: whoever is opening this has no
  // account yet, which is the point of the page.
  const invitation = await findInvitationByToken(token);

  const isClientInvite = invitation?.context_type.startsWith("client_") ?? false;
  const isAcademyInstructor = invitation?.context_type === "academy_instructor";
  const isAcademyAdmin = invitation?.context_type === "academy_admin";
  const isAcademyInvite = isAcademyInstructor || isAcademyAdmin;

  if (!invitation) {
    return (
      <AuthLayout title="Invitation">
        <Callout tone="danger">This invitation is not valid.</Callout>
      </AuthLayout>
    );
  }

  const expired = invitation.expires_at
    ? new Date(invitation.expires_at).getTime() < Date.now()
    : false;

  const { inviterName, accountName, professionalName } = await describeInvitation(invitation);
  const firmName = professionalName || accountName;
  const roleLabel =
    ROLE_LABELS[invitation.role_or_relationship ?? ""] ??
    invitation.role_or_relationship ??
    "a teammate";

  const scope =
    invitation.context_type === "partner_team"
      ? "Partner Center"
      : isClientInvite
        ? "Client Portal"
        : isAcademyInvite
          ? "Private Attaché Academy"
          : "Invitation";

  const title = isClientInvite
    ? "You're invited to the portal"
    : isAcademyInstructor
      ? "You're invited to teach"
      : isAcademyAdmin
        ? "You're invited to administer Academy"
        : "Accept invitation";

  if (expired) {
    return (
      <AuthLayout scope={scope} title={title} variant={isClientInvite ? "centered" : "split"}>
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-[380px] rounded-card-cp bg-surface p-6 text-center shadow-float">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-[22px] font-bold"
              style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}
            >
              !
            </div>
            <h2 className="mb-2 text-[19px] font-bold">This invitation has expired</h2>
            <p className="mb-6 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {isAcademyInstructor
                ? "Instructor invites expire after 24 hours. Ask an Academy Admin to send a new link."
                : isAcademyAdmin
                  ? "Admin invites expire after 24 hours. Ask the Academy Super Admin to send a new link."
                  : `Invitations expire after 14 days for security. Ask ${inviterName}${
                      firmName ? ` at ${firmName}` : ""
                    } to send a new one.`}
            </p>
            <Button href="/login" variant="primary" fullWidth>
              Return to sign in
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      scope={scope}
      title={title}
      subtitle={
        isClientInvite
          ? undefined
          : firmName
            ? `${inviterName} invited you to ${firmName}.`
            : `${inviterName} invited you to join the workspace.`
      }
      variant={isClientInvite ? "centered" : "split"}
      panel={isClientInvite ? undefined : <InvitePanel firmName={firmName} />}
      badge={isClientInvite ? <Pill tone="info">Invitation</Pill> : undefined}
      footer={
        isClientInvite ? (
          <p className="text-center text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link href="/login?brand=portal" className="font-medium">
              Sign in
            </Link>
          </p>
        ) : undefined
      }
    >
      {isClientInvite ? (
        <p className="mb-6 text-[14.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <strong style={{ color: "var(--ink)" }}>{inviterName}</strong>
          {firmName ? (
            <>
              {" at "}
              <strong style={{ color: "var(--ink)" }}>{firmName}</strong>
            </>
          ) : null}{" "}
          has invited you to coordinate your household in the Client Portal.
        </p>
      ) : null}
      <InviteAcceptForm
        token={token}
        email={invitation.invitee_email}
        inviteeName={invitation.invitee_name}
        inviterName={inviterName}
        role={roleLabel}
        submitLabel={isClientInvite ? "Accept invitation & continue" : undefined}
        showRoleCallout={!isClientInvite}
      />
    </AuthLayout>
  );
}
