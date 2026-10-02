"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { ensureReferralLink } from "@/partner-center/home/lib/ensure-referral-link";
import { usePartnerUi } from "@/partner-center/components/PartnerUiProvider";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

export function GetReferralLinkButton({
  label = "Get referral link",
  copyLabel = "Copy referral link",
  pendingLabel = "Preparing…",
  referralUrl = null,
  className,
}: {
  label?: string;
  copyLabel?: string;
  pendingLabel?: string;
  /** When set, the button copies this URL instead of generating a new one. */
  referralUrl?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const { showToast } = usePartnerUi();
  const { runAction } = usePartnerAction();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(referralUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUrl(referralUrl);
  }, [referralUrl]);

  async function copyText(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast("Link copied to clipboard");
      }
    } catch {
      /* ignore */
    }
  }

  function onClick() {
    setError(null);
    startTransition(async () => {
      let next = url;
      if (!next) {
        const result = await runAction(() => ensureReferralLink(), {
          onValidationError: setError,
          onRetry: onClick,
        });
        if (result.error) return;
        next = result.url || "";
        if (!next) {
          setError("Could not create referral link.");
          return;
        }
        setUrl(next);
        router.refresh();
      }
      await copyText(next);
    });
  }

  const hasLink = Boolean(url);

  return (
    <div className={className}>
      <Button
        type="button"
        variant="primary"
        disabled={pending}
        onClick={onClick}
      >
        {pending && !hasLink ? pendingLabel : hasLink ? copyLabel : label}
      </Button>
      {error ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
