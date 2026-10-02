"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { PARTNER_PATHS, SUPPORT_MAILTO } from "@/partner-center/lib/review-state";
import type { TaxPaymentView } from "@/partner-center/settings/lib/load-tax-payment";
import {
  collectionSourceLabel,
  formatTaxDate,
  formTypeLabel,
  paymentNeedsAction,
  paymentStatusPresentation,
  payoutMethodLabel,
  pillStyle,
  showHoldBanner,
  taxNeedsAction,
  taxStatusPresentation,
} from "@/partner-center/settings/lib/tax-presentation";
import { ViewSubmittedTaxModal } from "@/partner-center/settings/components/ViewSubmittedTaxModal";

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: Parameters<typeof pillStyle>[0];
}) {
  const style = pillStyle(tone);
  return (
    <span
      className="rounded px-2 py-0.5 text-[10.5px] font-medium"
      style={style}
    >
      {label}
    </span>
  );
}

function MetaRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-[13px]">
      <span style={{ color: "rgba(55,53,47,.5)" }}>{label}</span>
      <span
        className="text-right font-medium"
        style={{ color: warn ? "#8a6229" : "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

export function TaxPaymentOverview({ data }: { data: TaxPaymentView }) {
  const [viewOpen, setViewOpen] = useState(false);
  const taxUi = taxStatusPresentation(String(data.taxStatus));
  const paymentUi = paymentStatusPresentation(
    data.paymentSetupStatus,
    String(data.payoutEligibility),
  );
  const taxComplete = data.taxStatus === "complete";
  const canViewSubmitted = Boolean(
    data.tax && (taxComplete || data.tax.certified_at),
  );
  const needsTax = taxNeedsAction(data);
  const needsPayment = paymentNeedsAction(data);
  const paymentReady = data.paymentSetupStatus === "ready";

  return (
    <>
      {(data.taxStatus === "review_required" ||
        data.taxStatus === "expired" ||
        data.payoutEligibility === "on_hold") &&
      data.taxStatus !== "complete" ? (
        <div className="mb-5 space-y-3">
          {data.taxStatus === "review_required" || data.taxStatus === "expired" ? (
            <div
              className="flex items-start justify-between gap-4 rounded-[10px] border border-line bg-white px-4 py-3.5"
            >
              <div>
                <div className="text-[13.5px] font-semibold">{taxUi.label}</div>
                <p
                  className="mt-0.5 mb-0 text-[12.5px]"
                  style={{ color: "rgba(55,53,47,.5)" }}
                >
                  {taxUi.detail}
                </p>
              </div>
              <StatusPill label={taxUi.label} tone={taxUi.tone} />
            </div>
          ) : null}
          {data.payoutEligibility === "on_hold" ||
          data.paymentSetupStatus === "on_hold" ? (
            <div className="flex items-start justify-between gap-4 rounded-[10px] border border-line bg-white px-4 py-3.5">
              <div>
                <div className="text-[13.5px] font-semibold">Payout On Hold</div>
                <p
                  className="mt-0.5 mb-0 text-[12.5px]"
                  style={{ color: "rgba(55,53,47,.5)" }}
                >
                  Stripe flagged an issue with your account — payouts are paused
                  until it&apos;s resolved.
                </p>
              </div>
              <StatusPill label="On Hold" tone="danger" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-[10px] border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[14px] font-semibold">Tax profile</div>
            <StatusPill label={taxUi.label} tone={taxUi.tone} />
          </div>
          <MetaRow
            label="Form type"
            value={formTypeLabel(data.tax?.form_type)}
          />
          <MetaRow
            label="Last updated"
            value={formatTaxDate(
              data.tax?.certified_at || data.tax?.last_reviewed_at,
            )}
          />
          <MetaRow
            label="Collected via"
            value={collectionSourceLabel(data.tax?.collection_source)}
          />
          <div className="mt-4">
            {canViewSubmitted ? (
              <Button
                type="button"
                variant="secondary"
                unsized
                className="px-3.5 py-2 text-[13px]"
                onClick={() => setViewOpen(true)}
              >
                View submitted form
              </Button>
            ) : needsTax ? (
              <Button
                href={PARTNER_PATHS.settingsTaxSetup}
                variant="primary"
                unsized
                className="px-3.5 py-2 text-[13px]"
              >
                Complete tax setup
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-[10px] border border-line bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[14px] font-semibold">Payment method</div>
            <StatusPill label={paymentUi.label} tone={paymentUi.tone} />
          </div>
          <MetaRow
            label="Payout rail"
            value={payoutMethodLabel(data.preferredPayoutMethod)}
          />
          <MetaRow label="Status" value={paymentUi.statusLine} />
          <MetaRow
            label="Payout eligibility"
            value={paymentUi.eligibilityLine}
            warn={paymentUi.eligibilityWarning}
          />
          <div className="mt-4">
            {needsPayment ? (
              <Button
                href={
                  data.preferredPayoutMethod === "stripe_connect" ||
                  !data.preferredPayoutMethod
                    ? PARTNER_PATHS.settingsTaxStripe
                    : "/partner-center/payout"
                }
                variant="primary"
                unsized
                className="px-3.5 py-2 text-[13px]"
              >
                {data.preferredPayoutMethod === "stripe_connect" ||
                !data.preferredPayoutMethod
                  ? "Complete Stripe setup"
                  : "Complete payout setup"}
              </Button>
            ) : (
              <Button
                href="/partner-center/payout"
                variant="secondary"
                unsized
                className="px-3.5 py-2 text-[13px]"
              >
                Update payment method
              </Button>
            )}
          </div>
        </div>
      </div>

      {showHoldBanner(data) ? (
        <div
          className="mt-4 rounded-[8px] px-4 py-3 text-[13.5px] leading-[1.5]"
          style={{ background: "#fdf7ee", color: "#7a5a2e" }}
        >
          {data.payoutEligibility === "needs_tax_setup"
            ? "You can keep referring while this is pending. Earnings continue to accrue, but payouts stay on hold until your tax profile is finished."
            : "You can keep referring while this is pending. Earnings continue to accrue on your referrals, but payouts stay on hold until your payment method setup is finished."}
        </div>
      ) : null}

      <div className="mt-6 rounded-[10px] border border-line bg-white p-5">
        <div className="mb-3 text-[13.5px] font-semibold">Available actions</div>
        <ul className="m-0 list-none space-y-0 p-0">
          {needsPayment && !paymentReady ? (
            <ActionRow
              title={
                data.preferredPayoutMethod === "stripe_connect" ||
                !data.preferredPayoutMethod
                  ? "Complete Stripe setup"
                  : "Complete payout setup"
              }
              description={
                data.preferredPayoutMethod === "stripe_connect" ||
                !data.preferredPayoutMethod
                  ? "Finish bank and business details in Stripe's hosted flow"
                  : "Finish tax profile or confirm your preferred payout rail"
              }
              href={
                data.preferredPayoutMethod === "stripe_connect" ||
                !data.preferredPayoutMethod
                  ? PARTNER_PATHS.settingsTaxStripe
                  : "/partner-center/payout"
              }
              cta="Continue →"
            />
          ) : null}
          {paymentReady || data.paymentSetupStatus === "incomplete" ? (
            <ActionRow
              title="Update payment method"
              description="Switch payout rail or bank details"
              href="/partner-center/payout"
              cta="Update →"
            />
          ) : null}
          {needsTax || data.taxStatus === "expired" ? (
            <ActionRow
              title="Complete tax setup"
              description="Refresh or finish your W-9 / W-8 tax profile"
              href={PARTNER_PATHS.settingsTaxSetup}
              cta="Continue →"
            />
          ) : null}
          <ActionRow
            title="Contact support"
            description="Questions about your tax or payment setup"
            href={SUPPORT_MAILTO}
            cta="Message us →"
          />
        </ul>
      </div>

      {data.tax ? (
        <ViewSubmittedTaxModal
          open={viewOpen}
          onClose={() => setViewOpen(false)}
          tax={data.tax}
          taxDocumentId={data.taxDocumentId}
        />
      ) : null}
    </>
  );
}

function ActionRow({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <li
      className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0"
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium">{title}</div>
        <div
          className="mt-0.5 text-[12.5px]"
          style={{ color: "rgba(55,53,47,.5)" }}
        >
          {description}
        </div>
      </div>
      <Link
        href={href}
        className="shrink-0 text-[13px] font-semibold no-underline"
        style={{ color: "var(--accent)" }}
      >
        {cta}
      </Link>
    </li>
  );
}
