"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { disconnectPartnerStripe } from "@/partner-center/lib/payout-method-actions";
import { PARTNER_PATHS, SUPPORT_MAILTO } from "@/partner-center/lib/review-state";
import { StripeIcon } from "@/partner-center/onboarding/components/StripeIcon";

const STRIPE_CONNECT_API = "/api/partner-center/stripe/connect";

export function CompleteStripeSetupView({
  taxComplete,
  initialError,
  stripeLinked = false,
}: {
  taxComplete: boolean;
  initialError?: string;
  stripeLinked?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);
  const [linked, setLinked] = useState(stripeLinked);

  function onContinue() {
    setPending(true);
    setError(null);
    window.location.assign(STRIPE_CONNECT_API);
  }

  async function onDisconnect() {
    setPending(true);
    setError(null);
    try {
      const result = await disconnectPartnerStripe();
      if (result.error) {
        setError(result.error);
        return;
      }
      setLinked(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not disconnect Stripe.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6 text-center sm:px-6 lg:px-8 xl:px-12">
      <PartnerChrome
        title="Set up payouts with Stripe"
        subtitle="You'll be redirected to Stripe's secure, hosted onboarding to add your bank details and verify your business."
      />
      <div className="mb-5 flex justify-center">
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-[10px]"
          style={{
            background: "#eef5fc",
            boxShadow: "0 0 0 1px #d6e6f5",
          }}
        >
          <StripeIcon size={28} />
        </span>
      </div>
      <p
        className="mt-0 mb-6 text-[14px] leading-[1.55]"
        style={{ color: "rgba(55,53,47,.65)" }}
      >
        Your banking information stays with Stripe — Private Attaché never
        stores it.
      </p>

      <div className="mb-6 rounded-[10px] border border-line bg-white px-5 py-4 text-left">
        <div className="flex justify-between gap-3 border-b border-line py-2.5 text-[13.5px]">
          <span style={{ color: "rgba(55,53,47,.5)" }}>Payout rail</span>
          <span className="font-medium">Stripe Connect</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-line py-2.5 text-[13.5px]">
          <span style={{ color: "rgba(55,53,47,.5)" }}>Estimated time</span>
          <span className="font-medium">5–10 minutes</span>
        </div>
        <div className="flex justify-between gap-3 py-2.5 text-[13.5px]">
          <span style={{ color: "rgba(55,53,47,.5)" }}>Tax profile</span>
          <span
            className="font-medium"
            style={{ color: taxComplete ? "#1c7a52" : "#8a6229" }}
          >
            {taxComplete
              ? "Already on file — no new W-9 needed"
              : "Finish tax setup first for fastest payouts"}
          </span>
        </div>
      </div>

      <FormError message={error} />

      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={pending}
        onClick={onContinue}
      >
        {pending ? "Opening Stripe…" : "Continue to Stripe →"}
      </Button>

      {linked ? (
        <p className="mt-3 mb-0">
          <Button
            type="button"
            variant="ghost"
            className="text-[13px]"
            disabled={pending}
            onClick={() => void onDisconnect()}
          >
            Disconnect Stripe
          </Button>
        </p>
      ) : null}

      <p className="mt-4 mb-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        Questions about payouts?{" "}
        <a
          href={SUPPORT_MAILTO}
          className="font-semibold no-underline"
          style={{ color: "var(--accent)" }}
        >
          Contact support
        </a>
        . We won&apos;t ask for a new W-9 if your tax profile is already complete.
      </p>

      {!taxComplete ? (
        <p className="mt-3 mb-0">
          <Link
            href={PARTNER_PATHS.settingsTaxSetup}
            className="text-[13px] font-semibold no-underline"
            style={{ color: "var(--accent)" }}
          >
            Complete tax setup →
          </Link>
        </p>
      ) : null}

      <p className="mt-6 mb-0">
        <Link
          href={PARTNER_PATHS.settingsTax}
          className="text-[13px] no-underline"
          style={{ color: "var(--text-tertiary)" }}
        >
          ← Back to Tax & Payment Profile
        </Link>
      </p>
    </div>
  );
}
