"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { activatePartnerCenter } from "@/partner-center/lib/checklist-actions";

export function ActivatePartnerButton({
  label,
  variant = "link",
  skipped = false,
}: {
  label: string;
  variant?: "link" | "primary";
  skipped?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onActivate() {
    setPending(true);
    setError(null);
    try {
      const result = await activatePartnerCenter({ skipped });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.redirect || "/partner-center");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open Partner Center.");
    } finally {
      setPending(false);
    }
  }

  if (variant === "primary") {
    return (
      <div>
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => void onActivate()}
        >
          {pending ? "Opening…" : label}
        </Button>
        <FormError message={error} />
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => void onActivate()}
        className="text-[13.5px] disabled:opacity-60"
        style={{ color: "var(--text-secondary)" }}
      >
        {pending ? "Opening…" : label}
      </button>
      <FormError message={error} />
    </div>
  );
}
