"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { issueManualRailPayoutAction } from "@/super-admin/partner-center/actions";

export function IssueManualRailPayoutButton({
  partnerProfileId,
  method,
  disabled,
  needsOverride,
}: {
  partnerProfileId: string;
  method: "ach" | "check";
  disabled?: boolean;
  needsOverride?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reference, setReference] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = method === "ach" ? "ACH" : "Check";

  return (
    <div className="mt-2 space-y-2">
      <Input
        label={`${label} payout reference`}
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        disabled={disabled || pending}
        placeholder="Bank ref / check #"
      />
      {needsOverride ? (
        <Input
          label="Override reason"
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          disabled={disabled || pending}
          placeholder={`Required when preferred method ≠ ${label}`}
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
            const result = await issueManualRailPayoutAction({
              partnerProfileId,
              method,
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
        {pending ? "Recording…" : `Issue ${label} payout`}
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
