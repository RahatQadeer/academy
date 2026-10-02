"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { Callout } from "@/base/components/Callout";
import { TeamModal } from "@/partner-center/team/components/TeamModal";

/**
 * Shown after a team invite is created. Always offers a copyable accept link
 * so the admin can share it even when email delivery succeeded (or failed).
 */
export function InviteSentSuccessModal({
  email,
  inviteUrl,
  warning,
  onClose,
}: {
  email: string;
  inviteUrl: string;
  warning?: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <TeamModal
      title="Invitation sent"
      description={`An invite is ready for ${email}.`}
      onClose={onClose}
      footer={
        <Button type="button" variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <Callout tone="success" title="Invite created">
        {warning
          ? warning
          : "They’ll get an email with a link to join your partner team. You can also copy the link below."}
      </Callout>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label="Invite link"
            name="invite_url"
            value={inviteUrl}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void onCopy()}
          className="sm:mb-0.5 sm:shrink-0"
        >
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </TeamModal>
  );
}
