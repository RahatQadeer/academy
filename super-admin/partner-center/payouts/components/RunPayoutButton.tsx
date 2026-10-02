"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { runPartnerPayoutAction } from "@/super-admin/partner-center/actions";

export function RunPayoutButton({
  partnerProfileId,
  disabled,
}: {
  partnerProfileId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        variant="primary"
        disabled={disabled || pending}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await runPartnerPayoutAction({ partnerProfileId });
            if (result.error) {
              setError(result.error);
              return;
            }
            setMessage(result.message ?? "Payout complete.");
            router.refresh();
          });
        }}
      >
        {pending ? "Running…" : "Run Stripe payout"}
      </Button>
      {message ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
