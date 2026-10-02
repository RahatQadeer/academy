"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { Checkbox } from "@/partner-center/components/Checkbox";
import {
  recordOpportunityPaymentAction,
  validateOpportunityStripePaymentAction,
} from "@/super-admin/partner-center/actions";
import type { ValidateStripeOpportunityPaymentResult } from "@/super-admin/partner-center/opportunities/lib/validate-stripe-opportunity-payment-types";
import {
  AdminDetailSection,
  AdminFormGrid,
} from "@/super-admin/partner-center/components/AdminDetailSections";

/** Local calendar YYYY-MM-DD (collected payments cannot be dated after today). */
function todayLocalYmd(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type PaymentSource = "stripe" | "quickbooks";

type StripeValidationOk = Extract<
  ValidateStripeOpportunityPaymentResult,
  { ok: true }
>;

function formatUsdFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatCommission(preview: StripeValidationOk): string {
  if (preview.commissionOwedUsd != null) {
    return preview.commissionOwedUsd.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }
  return preview.commissionNote ?? "No commission owed under current rules.";
}

export function OpportunityRecordPayment({
  opportunityId,
  disabled,
}: {
  opportunityId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [validating, startValidate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<PaymentSource>("stripe");
  const [paymentId, setPaymentId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [stripePreview, setStripePreview] = useState<StripeValidationOk | null>(
    null,
  );
  const [companyNameConfirmed, setCompanyNameConfirmed] = useState(false);
  const maxPaymentDate = todayLocalYmd();

  function clearStripeValidation() {
    setStripePreview(null);
    setCompanyNameConfirmed(false);
  }

  function onPaymentIdChange(value: string) {
    setPaymentId(value);
    if (eventSource === "stripe") clearStripeValidation();
  }

  function onEventSourceChange(value: PaymentSource) {
    setEventSource(value);
    clearStripeValidation();
    setError(null);
    setMessage(null);
  }

  function validateStripe() {
    setError(null);
    setMessage(null);
    clearStripeValidation();

    if (!paymentId.trim()) {
      setError("Stripe id is required (e.g. in_…, pi_…, or ch_…).");
      return;
    }

    startValidate(async () => {
      try {
        const result = await validateOpportunityStripePaymentAction({
          opportunityId,
          paymentId: paymentId.trim(),
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setStripePreview(result);
      } catch {
        setError("Could not validate payment. Try again.");
      }
    });
  }

  function submit() {
    setError(null);
    setMessage(null);

    if (!paymentId.trim()) {
      setError(
        eventSource === "quickbooks"
          ? "QuickBooks payment id is required (e.g. 145 or qbo_payment_145)."
          : "Stripe id is required (e.g. in_…, pi_…, or ch_…).",
      );
      return;
    }

    if (eventSource === "stripe") {
      if (!stripePreview) {
        setError("Validate the Stripe payment before recording.");
        return;
      }
      if (
        stripePreview.matchMethod === "company_name" &&
        !companyNameConfirmed
      ) {
        setError("Confirm the company name match before recording.");
        return;
      }
    }

    const trimmedDate = paymentDate.trim();
    if (trimmedDate && trimmedDate > maxPaymentDate) {
      setError("Payment date cannot be in the future.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await recordOpportunityPaymentAction({
          opportunityId,
          paymentId:
            eventSource === "stripe" && stripePreview
              ? stripePreview.resolvedPaymentId
              : paymentId.trim(),
          paymentDate: trimmedDate || undefined,
          eventSource,
        });

        if (result.error) {
          setError(result.error);
          return;
        }

        setMessage(result.message ?? "Payment recorded.");
        setPaymentId("");
        setPaymentDate("");
        clearStripeValidation();
        router.refresh();
      } catch {
        setError("Could not record payment. Try again.");
      }
    });
  }

  const busy = pending || validating || Boolean(disabled);
  const stripeValidated = eventSource === "stripe" && stripePreview != null;
  const companyConfirmNeeded =
    stripeValidated && stripePreview.matchMethod === "company_name";
  const recordEnabled =
    !busy &&
    (eventSource === "quickbooks" ||
      (stripeValidated &&
        (!companyConfirmNeeded || companyNameConfirmed)));

  return (
    <AdminDetailSection title="Record payment" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Match a real Stripe or QuickBooks payment to this opportunity.
      </p>
      <AdminFormGrid>
        <label className="block">
          <span
            className="mb-1.5 block text-[12.5px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            Payment source
          </span>
          <select
            className="w-full rounded-control border border-line-strong bg-surface py-[9px] pl-3 pr-3 text-[14.5px] text-ink"
            value={eventSource}
            disabled={busy}
            onChange={(event) =>
              onEventSourceChange(event.target.value as PaymentSource)
            }
          >
            <option value="stripe">Stripe</option>
            <option value="quickbooks">QuickBooks</option>
          </select>
        </label>
        <div className="block sm:col-span-1">
          <Input
            label={
              eventSource === "quickbooks"
                ? "QuickBooks payment id"
                : "Stripe id"
            }
            value={paymentId}
            onChange={(event) => onPaymentIdChange(event.target.value)}
            placeholder={
              eventSource === "quickbooks"
                ? "145 or qbo_payment_145"
                : "in_…, pi_…, or ch_…"
            }
            disabled={busy}
          />
          {eventSource === "stripe" ? (
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !paymentId.trim()}
                onClick={validateStripe}
              >
                {validating ? "Validating…" : "Validate payment"}
              </Button>
            </div>
          ) : null}
        </div>
        <Input
          label="Payment date (optional override)"
          type="date"
          value={paymentDate}
          max={maxPaymentDate}
          onChange={(event) => setPaymentDate(event.target.value)}
          disabled={busy}
          hint="Leave blank to use the date from Stripe or QuickBooks."
        />
      </AdminFormGrid>

      {stripePreview ? (
        <div
          className="mt-4 rounded-control border border-line-strong px-3 py-3"
          style={{ background: "var(--bg-elevated, transparent)" }}
        >
          <p
            className="mb-2 text-[12.5px] font-medium"
            style={{ color: "var(--text-tertiary)" }}
          >
            Validation details
          </p>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Company / customer
              </dt>
              <dd className="text-[13.5px] text-ink">{stripePreview.customerName}</dd>
            </div>
            <div>
              <dt
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Invoice status
              </dt>
              <dd className="text-[13.5px] text-ink">{stripePreview.invoiceStatus}</dd>
            </div>
            <div>
              <dt
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Amount received
              </dt>
              <dd className="text-[13.5px] text-ink">
                {formatUsdFromCents(stripePreview.amountCollectedCents)}
              </dd>
            </div>
            <div>
              <dt
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Partner
              </dt>
              <dd className="text-[13.5px] text-ink">{stripePreview.partnerName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Commission owed
              </dt>
              <dd className="text-[13.5px] text-ink">
                {formatCommission(stripePreview)}
              </dd>
            </div>
          </dl>
          {stripePreview.matchMethod === "company_name" ? (
            <div className="mt-3 space-y-2">
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                Matched by company name, please confirm
              </p>
              <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Invoice: {stripePreview.customerName} · Opportunity:{" "}
                {stripePreview.opportunityCompanyName}
              </p>
              <Checkbox
                checked={companyNameConfirmed}
                onChange={setCompanyNameConfirmed}
              >
                I confirm these company names refer to the same customer.
              </Checkbox>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        {eventSource === "stripe"
          ? "Validate a Stripe invoice or payment first. Amount is taken from the paid invoice after checks — you do not enter it here."
          : "Amount is taken from the provider after lookup — you do not enter it here."}
      </p>
      <div className="mt-4">
        <Button
          type="button"
          variant="primary"
          disabled={!recordEnabled}
          onClick={submit}
        >
          {pending ? "Looking up…" : "Record payment"}
        </Button>
      </div>
      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      ) : null}
    </AdminDetailSection>
  );
}
