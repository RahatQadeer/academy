"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Callout } from "@/base/components/Callout";
import {
  fulfillCheckoutSessionAction,
  startStripeCheckoutAction,
} from "@/academy/enrollment/actions";
import type { CheckoutPageData } from "@/academy/enrollment/types";
import { checkoutMessage } from "@/academy/enrollment/utils/messages";
import { formatCheckoutAmount } from "@/academy/enrollment/utils/payment";
import { lessonPlayerHref } from "@/academy/lesson-player/utils/curriculum";

export function CheckoutView({
  data,
  canceled,
}: {
  data: CheckoutPageData;
  canceled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { checkout, programDescription, stripeEnabled } = data;
  const programHref = `/academy/explore/${checkout.programId}`;
  const amountLabel = formatCheckoutAmount(checkout.amount, checkout.currency);

  if (checkout.status === "paid") {
    return (
      <Shell>
        <Callout tone="success" title="Payment complete">
          You are enrolled in {checkout.programName}. Course content is now available.
        </Callout>
        <Link
          href={lessonPlayerHref(checkout.programId)}
          className="mt-5 inline-flex rounded-[8px] px-4 py-2.5 text-[13.5px] font-medium no-underline"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Open course
        </Link>
      </Shell>
    );
  }

  if (checkout.status !== "pending") {
    return (
      <Shell>
        <Callout tone="warning" title="Checkout unavailable">
          {checkoutMessage(
            checkout.status === "expired" ? "checkout_expired" : "checkout_not_pending",
          )}
        </Callout>
        <Link
          href={programHref}
          className="mt-5 inline-flex text-[13.5px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          ← Back to program
        </Link>
      </Shell>
    );
  }

  function handlePay() {
    setError(null);
    startTransition(async () => {
      if (stripeEnabled) {
        const result = await startStripeCheckoutAction(checkout.id);
        if (result.status === "redirect") {
          window.location.href = result.url;
          return;
        }
        if (result.status === "paid") {
          router.push(lessonPlayerHref(checkout.programId));
          router.refresh();
          return;
        }
        setError(checkoutMessage(result.reason));
        return;
      }

      const result = await fulfillCheckoutSessionAction(checkout.id);
      if (result.status === "paid" || result.status === "already_paid") {
        router.push(lessonPlayerHref(checkout.programId));
        router.refresh();
        return;
      }
      setError(checkoutMessage(result.reason));
    });
  }

  return (
    <Shell>
      <Link
        href={programHref}
        className="inline-flex text-[13px] font-medium no-underline"
        style={{ color: "var(--text-secondary)" }}
      >
        ← Back to program
      </Link>

      <h1
        className="mt-8 text-[28px] font-bold tracking-[-0.45px] text-wrap-pretty"
        style={{ color: "var(--ink)" }}
      >
        Complete your purchase
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        One payment unlocks every lesson, assignment, and assessment in this program.
      </p>

      {canceled ? (
        <div className="mt-5">
          <Callout tone="info" title="Payment canceled">
            You can return to checkout any time to finish your purchase.
          </Callout>
        </div>
      ) : null}

      <section
        className="mt-8 rounded-[10px] border"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="border-b px-5 py-5" style={{ borderColor: "var(--border)" }}>
          <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            Order summary
          </p>
          <h2
            className="mt-1.5 text-[16px] font-semibold tracking-[-0.02em] text-wrap-pretty"
            style={{ color: "var(--ink)" }}
          >
            {checkout.programName}
          </h2>
          {programDescription ? (
            <p
              className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {programDescription}
            </p>
          ) : null}
        </div>

        <div className="flex items-baseline justify-between gap-4 px-5 py-4">
          <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            Total due today
          </p>
          <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em]" style={{ color: "var(--ink)" }}>
            {amountLabel}
          </p>
        </div>
      </section>

      <button
        type="button"
        disabled={pending}
        className="mt-5 inline-flex w-full items-center justify-center rounded-[8px] px-4 py-3 text-[14.5px] font-semibold"
        style={{
          background: "var(--accent)",
          color: "#fff",
          opacity: pending ? 0.55 : 1,
          cursor: pending ? "not-allowed" : "pointer",
          border: 0,
        }}
        onClick={handlePay}
      >
        {pending
          ? "Preparing secure checkout…"
          : stripeEnabled
            ? `Continue to payment · ${amountLabel}`
            : `Pay ${amountLabel}`}
      </button>

      <p className="mt-4 text-[12.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {stripeEnabled
          ? "You’ll continue on Stripe’s secure checkout. Card details never touch Academy servers."
          : "Development checkout only. Add STRIPE_SECRET_KEY to use live Stripe payments."}{" "}
        Cancel anytime before you pay.
      </p>

      {error ? (
        <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--warning-fg)" }}>
          {error}
        </p>
      ) : null}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[480px] px-6 py-10 lg:px-8 lg:py-14">{children}</div>
  );
}
