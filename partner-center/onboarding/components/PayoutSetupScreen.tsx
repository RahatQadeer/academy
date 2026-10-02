"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import {
  disconnectPartnerStripe,
  selectPreferredPayoutMethod,
} from "@/partner-center/lib/payout-method-actions";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import { StripeIcon } from "@/partner-center/onboarding/components/StripeIcon";
import type { PayoutMethodOption } from "@/super-admin/partner-center/services/platform-tax-config";

/** Partner UI never offers QuickBooks — that rail is admin/staff only. */
type PartnerFacingPayoutMethod = Exclude<PayoutMethodOption, "quickbooks">;

const METHOD_COPY: Record<
  PartnerFacingPayoutMethod,
  { title: string; subtitle: string; cta: string }
> = {
  stripe_connect: {
    title: "Stripe Connect",
    subtitle: "Recommended — fastest setup, direct deposit",
    cta: "Connect",
  },
  ach: {
    title: "ACH",
    subtitle: "Bank transfer recorded by Private Attaché staff",
    cta: "Select",
  },
  check: {
    title: "Check",
    subtitle: "Paper check recorded by Private Attaché staff",
    cta: "Select",
  },
};

function methodCta(
  method: PartnerFacingPayoutMethod,
  isPreferred: boolean,
  stripeLinked: boolean,
): string {
  if (!isPreferred) return METHOD_COPY[method].cta;
  if (method === "stripe_connect") {
    return stripeLinked ? "Continue" : "Connect";
  }
  return "Selected";
}

export function PayoutSetupScreen({
  variant = "checklist",
  availableMethods = ["stripe_connect"],
  preferredMethod = null,
  stripeLinked = false,
  paymentSetupReady = false,
  readOnly = false,
}: {
  variant?: "checklist" | "app";
  availableMethods?: PayoutMethodOption[];
  preferredMethod?: PayoutMethodOption | null;
  /** Partner has a stored Stripe Connect account id. */
  stripeLinked?: boolean;
  /** payment_setup_status === ready (Stripe transfers active or non-Stripe ready). */
  paymentSetupReady?: boolean;
  /** Checklist "View" — method selection and disconnect are disabled. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<PayoutMethodOption | null>(
    preferredMethod,
  );
  const [linked, setLinked] = useState(stripeLinked);

  const laterHref =
    variant === "app" ? PARTNER_PATHS.app : PARTNER_PATHS.checklist;

  // Partners only choose Stripe Connect here — QuickBooks stays an admin/staff rail.
  const methods = availableMethods.filter(
    (m): m is PartnerFacingPayoutMethod =>
      m !== "quickbooks" && m in METHOD_COPY,
  );
  const onlyStripe =
    methods.length === 1 && methods[0] === "stripe_connect";

  // Tax "Continue to Stripe" already preferred Connect — open onboarding, don't
  // make them pick Stripe again on this screen.
  useEffect(() => {
    if (readOnly || linked || pending) return;
    if (selected !== "stripe_connect" || !onlyStripe) return;
    router.replace(PARTNER_PATHS.payoutStripe);
  }, [readOnly, linked, pending, selected, onlyStripe, router]);

  async function onSelect(method: PayoutMethodOption) {
    const isPreferred = selected === method;
    if (isPreferred && method !== "stripe_connect") {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await selectPreferredPayoutMethod(method);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSelected(method);
      const next = result.redirect;
      if (!next) return;
      if (next.startsWith("https://") || next.startsWith("http://")) {
        window.location.href = next;
        return;
      }
      router.push(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
    } finally {
      setPending(false);
    }
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

  const body = (
    <>
      <div className="mt-6 space-y-3">
        {methods.map((method) => {
          const copy = METHOD_COPY[method];
          const isPreferred = selected === method;
          const cta = methodCta(method, isPreferred, linked);
          const nonStripeSelected =
            isPreferred && method !== "stripe_connect";
          return (
            <div
              key={method}
              className="flex items-center gap-3 rounded-[10px] px-4 py-3.5"
              style={{ border: "1px solid var(--border-strong)" }}
            >
              {method === "stripe_connect" ? (
                <StripeIcon size={32} />
              ) : (
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-semibold"
                  style={{
                    background: "var(--surface-soft)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  {method === "ach" ? "A" : "C"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">{copy.title}</div>
                <div
                  className="text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {isPreferred
                    ? method === "stripe_connect"
                      ? paymentSetupReady && linked
                        ? "Connected — ready for payouts"
                        : linked
                          ? "Selected — finish Stripe onboarding if prompted"
                          : copy.subtitle
                      : "Selected — complete tax setup if prompted."
                    : copy.subtitle}
                </div>
              </div>
              {readOnly ? (
                isPreferred ? (
                  <span
                    className="rounded px-[7px] py-[2px] text-[10.5px] font-medium"
                    style={{
                      background: "var(--success-bg)",
                      color: "var(--success-fg)",
                    }}
                  >
                    Selected
                  </span>
                ) : null
              ) : (
                <Button
                  type="button"
                  variant={method === "stripe_connect" ? "primary" : "secondary"}
                  className="px-4 py-[7px] text-[13.5px]"
                  disabled={pending || nonStripeSelected}
                  onClick={() => void onSelect(method)}
                >
                  {pending ? "…" : cta}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {linked && !readOnly ? (
        <div className="mt-4 text-center">
          <Button
            type="button"
            variant="ghost"
            className="text-[13px]"
            disabled={pending}
            onClick={() => void onDisconnect()}
          >
            Disconnect Stripe
          </Button>
        </div>
      ) : null}
      <FormError message={error} />
      <div className="mt-6 text-center">
        {readOnly ? (
          <Button href={laterHref} variant="primary">
            Back to checklist
          </Button>
        ) : (
          <Button href={laterHref} variant="ghost">
            Do this later
          </Button>
        )}
      </div>
    </>
  );

  if (variant === "app") {
    return (
      <div className="mx-auto max-w-[560px] px-5 py-6 sm:px-6 lg:px-8 xl:px-12">
        <PartnerChrome
          title="Set up payouts"
          subtitle="Connect a payout method so earned commissions can be paid to you. You can start referring before this is complete."
        />
        {body}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-canvas px-6">
      <div className="flex min-h-full items-center justify-center py-14">
        <div
          className="w-full max-w-[520px] rounded-[10px] bg-surface p-8"
          style={{ border: "1px solid var(--border)" }}
        >
          <h1 className="text-[24px] font-bold tracking-[-0.4px]">
            Set up payouts
          </h1>
          <p
            className="mt-2 text-[13.5px] leading-[1.55]"
            style={{ color: "var(--text-secondary)" }}
          >
            Connect a payout method so earned commissions can be paid to you.
            You can start referring before this is complete.
          </p>
          {body}
        </div>
      </div>
    </div>
  );
}
