"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { formatCredentialDate } from "../lib/format";
import { isCredentialRenewalOpen } from "@/academy/lib/credentialRenewal/eligibility";
import { renewCredentialAction } from "../actions";

export function RenewCredentialButton({
  credentialId,
  expiresAt,
}: {
  credentialId: string;
  expiresAt: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!expiresAt) return null;

  const open = isCredentialRenewalOpen(expiresAt);
  const availableLabel = `Available ${formatCredentialDate(expiresAt)}`;

  function renew() {
    if (!open) return;
    startTransition(async () => {
      setError(null);
      const result = await renewCredentialAction(credentialId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={open ? "secondary" : "secondary"}
        disabled={!open || pending}
        onClick={renew}
        title={open ? "Extend the certificate by three years" : availableLabel}
      >
        {pending ? "Renewing…" : open ? "Renew 3-year term" : availableLabel}
      </Button>
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {open
          ? "Extends expiry by 3 years from the later of today or the current expiry, and resets 90 / 60 / 30 day renewal reminders."
          : `Renewal stays locked until the expiration date (${formatCredentialDate(expiresAt)}). Early renewals that stack extra years are not allowed.`}
      </p>
      {error ? (
        <p className="text-[13px]" style={{ color: "var(--warning-fg)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
