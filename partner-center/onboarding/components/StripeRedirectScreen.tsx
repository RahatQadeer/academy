"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FormError } from "@/base/components/AuthControls";
import { markPayoutStarted } from "@/partner-center/lib/checklist-actions";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import { StripeIcon } from "@/partner-center/onboarding/components/StripeIcon";

function StripeRedirectBody({
  error,
  cancelHref,
  onCancel,
}: {
  error: string | null;
  cancelHref: string;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="mb-6 flex justify-center">
        <span
          className="inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(99,91,255,0.18) 0%, rgba(99,91,255,0.06) 55%, transparent 70%)",
          }}
        >
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px]"
            style={{
              background: "var(--surface-soft)",
              boxShadow: "0 0 0 1px var(--border)",
            }}
          >
            <StripeIcon size={28} />
          </span>
        </span>
      </div>
      <h1 className="mb-2 text-[20px] font-bold tracking-[-0.35px]">
        Redirecting you to Stripe
      </h1>
      <p
        className="mx-auto mb-8 max-w-[340px] text-[13.5px] leading-[1.55]"
        style={{ color: "var(--text-secondary)" }}
      >
        You&apos;ll complete identity, business, and banking details directly with
        Stripe. Private Attaché never sees your bank details — only your setup
        status.
      </p>
      <FormError message={error} />
      <Link
        href={cancelHref}
        className="text-[13.5px] no-underline"
        style={{ color: "var(--text-tertiary)" }}
        onClick={onCancel}
      >
        Cancel and go back
      </Link>
    </>
  );
}

export function StripeRedirectScreen({
  variant = "checklist",
}: {
  variant?: "checklist" | "app";
}) {
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const cancelHref =
    variant === "app" ? PARTNER_PATHS.payoutApp : PARTNER_PATHS.payout;

  useEffect(() => {
    cancelled.current = false;
    void (async () => {
      try {
        const result = await markPayoutStarted();
        if (cancelled.current) return;
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.redirect) {
          window.location.href = result.redirect;
          return;
        }
        setError("Stripe did not return an onboarding link.");
      } catch (caught) {
        if (cancelled.current) return;
        setError(
          caught instanceof Error ? caught.message : "Could not continue.",
        );
      }
    })();

    return () => {
      cancelled.current = true;
    };
  }, []);

  const body = (
    <StripeRedirectBody
      error={error}
      cancelHref={cancelHref}
      onCancel={() => {
        cancelled.current = true;
      }}
    />
  );

  if (variant === "app") {
    return (
      <div className="mx-auto max-w-[560px] px-5 py-8 text-center sm:px-6 lg:px-8 xl:px-12">
        {body}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-canvas px-6">
      <div className="flex min-h-full items-center justify-center py-14">
        <div
          className="w-full max-w-[440px] rounded-[10px] bg-surface px-8 py-10 text-center"
          style={{ border: "1px solid var(--border)" }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}
