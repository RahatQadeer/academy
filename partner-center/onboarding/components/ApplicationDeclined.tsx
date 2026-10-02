"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { FormError } from "@/base/components/AuthControls";
import { reapplyPartnerApplication } from "@/partner-center/lib/application-actions";
import { DEFAULT_DECLINE_REASON } from "@/partner-center/lib/review-state";
import { StatusCanvas } from "@/partner-center/onboarding/components/StatusScreen";

export function ApplicationDeclined({ reason }: { reason?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReapply() {
    setPending(true);
    setError(null);
    try {
      const result = await reapplyPartnerApplication();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.redirect || "/partner-center/onboarding");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not start a new application.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <StatusCanvas>
      <div className="text-center">
        <Pill tone="danger">Not approved at this time</Pill>
        <h1 className="mb-3 mt-3 text-[20px] font-bold tracking-[-0.35px]">
          Your application wasn&apos;t approved
        </h1>
        <p
          className="mb-6 text-[13.5px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          {reason || DEFAULT_DECLINE_REASON}
        </p>
        <FormError message={error} />
        <Button
          type="button"
          variant="primary"
          fullWidth
          disabled={pending}
          onClick={() => void onReapply()}
        >
          {pending ? "Starting…" : "Re-apply"}
        </Button>
      </div>
    </StatusCanvas>
  );
}
