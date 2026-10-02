"use client";

import { Callout } from "@/base/components/Callout";
import { Button } from "@/base/components/Button";
import { PartnerAuthLayout } from "@/partner-center/auth/components/PartnerAuthLayout";
import { PartnerInviteAcceptForm } from "@/partner-center/auth/components/PartnerInviteAcceptForm";
import {
  PartnerInviteSessionHandler,
  PARTNER_INVITE_CONTINUE_PATH,
} from "@/partner-center/auth/components/PartnerInviteSessionHandler";

export function PartnerInviteAcceptView({
  token,
  email,
  inviteeName,
  inviterName,
  role,
  expired,
  status,
}: {
  token: string;
  email: string;
  inviteeName: string | null;
  inviterName: string;
  role: string;
  expired: boolean;
  status: string;
}) {
  const accepted = status === "accepted";
  const pending = status === "pending";

  if (expired && pending) {
    return (
      <PartnerAuthLayout title="Invitation expired" backHref="/partner-center/signin">
        <Callout tone="danger">
          Invitations expire after 14 days. Ask {inviterName} to send a new one.
        </Callout>
        <div className="mt-4">
          <Button href="/partner-center/signin" variant="primary" fullWidth>
            Return to sign in
          </Button>
        </div>
      </PartnerAuthLayout>
    );
  }

  // Already used — claim any hash session and go to the app. Do not show
  // "no longer active"; that reads like a broken link even though membership
  // already exists.
  if (accepted) {
    return (
      <>
        <PartnerInviteSessionHandler continueTo={PARTNER_INVITE_CONTINUE_PATH} />
        <PartnerAuthLayout title="Welcome back" backHref="/partner-center/signin">
          <Callout>You are already on this partner team.</Callout>
          <div className="mt-4">
            <Button href={PARTNER_INVITE_CONTINUE_PATH} variant="primary" fullWidth>
              Continue to Partner Center
            </Button>
          </div>
        </PartnerAuthLayout>
      </>
    );
  }

  if (!pending) {
    return (
      <PartnerAuthLayout title="Invitation" backHref="/partner-center/signin">
        <Callout tone="warning">
          This invitation is no longer available. Ask {inviterName} to send a new
          one if you still need access.
        </Callout>
        <div className="mt-4">
          <Button href="/partner-center/signin" variant="primary" fullWidth>
            Sign in
          </Button>
        </div>
      </PartnerAuthLayout>
    );
  }

  return (
    <>
      <PartnerInviteSessionHandler />
      <PartnerAuthLayout
        title="Accept invitation"
        description="Join your partner team in Partner Center."
        backHref="/partner-center/signin"
      >
        <PartnerInviteAcceptForm
          token={token}
          email={email}
          inviteeName={inviteeName}
          inviterName={inviterName}
          role={role}
        />
      </PartnerAuthLayout>
    </>
  );
}
