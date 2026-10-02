"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { FormError } from "@/base/components/AuthControls";
import { Textarea } from "@/partner-center/components/Textarea";
import { resubmitRequestedInfo } from "@/partner-center/lib/review-actions";
import { DEFAULT_INFO_REQUEST_MESSAGE } from "@/partner-center/lib/review-state";
import { StatusCanvas } from "@/partner-center/onboarding/components/StatusScreen";

export function MoreInfoNeeded({
  companyName,
  message,
}: {
  companyName: string | null;
  message: string;
}) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await resubmitRequestedInfo({ response });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.redirect || "/partner-center/onboarding/pending");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resubmit.");
    } finally {
      setPending(false);
    }
  }

  return (
    <StatusCanvas>
      <div className="text-center">
        <Pill tone="warning">More Info Needed</Pill>
        <h1 className="mb-1.5 mt-3 text-[20px] font-bold tracking-[-0.35px]">
          We need a bit more information
        </h1>
        <p
          className="text-[13.5px] leading-[1.55]"
          style={{ color: "var(--text-secondary)" }}
        >
          Application{companyName ? ` for ${companyName}` : ""}.
        </p>
      </div>
      <div className="mt-5">
        <Callout tone="warning">
          {message || DEFAULT_INFO_REQUEST_MESSAGE}
        </Callout>
      </div>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <Textarea
          label="Your reply"
          name="response"
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          placeholder="Add the details they asked for…"
          required
          rows={6}
        />
        <FormError message={error} />
        <Button type="submit" variant="primary" fullWidth disabled={pending}>
          {pending ? "Resubmitting…" : "Resubmit application"}
        </Button>
      </form>
    </StatusCanvas>
  );
}
