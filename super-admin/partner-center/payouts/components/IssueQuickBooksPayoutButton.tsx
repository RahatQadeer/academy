"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { issueQuickBooksPayoutAction } from "@/super-admin/partner-center/actions";

export function IssueQuickBooksPayoutButton({
  partnerProfileId,
  disabled,
  needsOverride,
}: {
  partnerProfileId: string;
  disabled?: boolean;
  needsOverride?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reference, setReference] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-2 space-y-2">
      <Input
        label="QB payout reference"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        disabled={disabled || pending}
        placeholder="Check # / ACH ref / memo"
      />
      {needsOverride ? (
        <Input
          label="Override reason"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          disabled={disabled || pending}
          placeholder="Required when preferred method ≠ QuickBooks"
        />
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || pending || !reference.trim()}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await issueQuickBooksPayoutAction({
              partnerProfileId,
              reference,
              overrideReason: needsOverride ? overrideReason : undefined,
            });
            if (result.error) {
              setError(result.error);
              return;
            }
            setMessage(result.message ?? "Recorded.");
            setReference("");
            setOverrideReason("");
            router.refresh();
          });
        }}
      >
        {pending ? "Recording…" : "Issue QuickBooks payout"}
      </Button>
      {message ? (
        <p className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-[12.5px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
