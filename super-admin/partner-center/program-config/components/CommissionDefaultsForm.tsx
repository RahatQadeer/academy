"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { Checkbox } from "@/partner-center/components/Checkbox";
import {
  ALL_REVENUE_EXCLUSIONS,
  type RevenueComponent,
} from "@/partner-center/lib/attribution/eligible-revenue";
import type { PaymentTermsConfig } from "@/partner-center/lib/attribution/payment-terms";
import {
  saveGlobalCommissionRuleAction,
  savePlatformAttributionConfigAction,
} from "@/super-admin/partner-center/actions";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import type {
  ConversionEligibility,
  PlatformAttributionConfig,
} from "@/super-admin/partner-center/services/platform-attribution-config";
import type { GlobalCommissionRule } from "@/super-admin/partner-center/services/saveCommissionDefaults";

const BASIS_OPTIONS = [
  { value: "first_collected_payment", label: "First collected payment" },
  { value: "each_collected_payment", label: "Each collected payment" },
  { value: "collected_revenue_period", label: "Collected revenue for a period" },
  { value: "fixed_amount", label: "Fixed amount" },
  { value: "custom", label: "Custom" },
];

const PERIOD_OPTIONS = [
  { value: "one_payment", label: "One payment only" },
  { value: "30 days", label: "30 days" },
  { value: "60 days", label: "60 days" },
  { value: "90 days", label: "90 days" },
  { value: "3 months", label: "3 months" },
  { value: "6 months", label: "6 months" },
  { value: "12 months", label: "12 months" },
  { value: "unlimited", label: "Unlimited / custom ongoing" },
];

const EXCLUSION_LABELS: Record<RevenueComponent, string> = {
  tax: "Taxes",
  refunds: "Refunds",
  credits: "Credits",
  overages: "AI / usage overages",
  pass_through: "Pass-through expenses",
};

function programLabel(program: string) {
  if (program === "academy") return "Academy";
  if (program === "platform") return "Whitby";
  return "Enterprise";
}

function RuleEditor({
  initial,
}: {
  initial: GlobalCommissionRule;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rateType, setRateType] = useState(initial.rateType);
  const [rateValue, setRateValue] = useState(String(initial.rateValue));
  const [earningBasis, setEarningBasis] = useState(initial.earningBasis);
  const [eligiblePeriod, setEligiblePeriod] = useState(initial.eligiblePeriod);
  const [windowDays, setWindowDays] = useState(
    String(initial.attributionWindowDays),
  );
  const [netDays, setNetDays] = useState(String(initial.paymentTerms.netDays));
  const [holdDays, setHoldDays] = useState(
    String(initial.paymentTerms.holdDays),
  );
  const [minPayout, setMinPayout] = useState(
    String(initial.paymentTerms.minPayoutDollars),
  );
  const [cadence, setCadence] = useState(initial.paymentTerms.cadence);
  const [exclude, setExclude] = useState<RevenueComponent[]>(
    initial.excludeRevenue,
  );
  const [waitingDays, setWaitingDays] = useState(
    String(initial.newCustomerPeriodDays),
  );

  function toggleExclude(id: RevenueComponent, checked: boolean) {
    setExclude((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id),
    );
  }

  function submit() {
    setError(null);
    setMessage(null);
    const paymentTerms: PaymentTermsConfig = {
      display:
        cadence === "monthly_in_arrears"
          ? "Monthly in arrears"
          : `Net ${Number(netDays) || 0}`,
      netDays: Number(netDays) || 0,
      holdDays: Number(holdDays) || 0,
      cadence,
      minPayoutDollars: Number(minPayout) || 0,
    };

    startTransition(async () => {
      const result = await saveGlobalCommissionRuleAction({
        program: initial.program,
        rateType,
        rateValue: Number(rateValue),
        earningBasis,
        eligiblePeriod,
        attributionWindowDays: Number(windowDays),
        paymentTerms,
        excludeRevenue: exclude,
        refundRule: null,
        newCustomerPeriodDays: Number(waitingDays) || 60,
        effectiveStart: initial.effectiveStart,
        effectiveEnd: initial.effectiveEnd,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  return (
    <div className="pa-partner-card p-4">
      <h3 className="mb-3 text-[16px] font-semibold">
        {programLabel(initial.program)} defaults
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px]">
          <span style={{ color: "var(--text-tertiary)" }}>Rate type</span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={rateType}
            disabled={pending}
            onChange={(e) =>
              setRateType(e.target.value as "percentage" | "flat")
            }
          >
            <option value="percentage">Percentage</option>
            <option value="flat">Flat amount</option>
          </select>
        </label>
        <Input
          label={rateType === "flat" ? "Flat amount ($)" : "Rate (%)"}
          value={rateValue}
          onChange={(e) => setRateValue(e.target.value)}
          disabled={pending}
        />
        <label className="block text-[13px]">
          <span style={{ color: "var(--text-tertiary)" }}>Earning basis</span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={earningBasis}
            disabled={pending}
            onChange={(e) => setEarningBasis(e.target.value)}
          >
            {BASIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px]">
          <span style={{ color: "var(--text-tertiary)" }}>Eligible period</span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={eligiblePeriod}
            disabled={pending}
            onChange={(e) => setEligiblePeriod(e.target.value)}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Attribution window (days)"
          value={windowDays}
          onChange={(e) => setWindowDays(e.target.value)}
          disabled={pending}
        />
        <Input
          label="New-partner waiting period (days)"
          value={waitingDays}
          onChange={(e) => setWaitingDays(e.target.value)}
          disabled={pending}
        />
        <label className="block text-[13px]">
          <span style={{ color: "var(--text-tertiary)" }}>Payment cadence</span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={cadence}
            disabled={pending}
            onChange={(e) =>
              setCadence(e.target.value as PaymentTermsConfig["cadence"])
            }
          >
            <option value="net">Net terms</option>
            <option value="monthly_in_arrears">Monthly in arrears</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <Input
          label="Net days"
          value={netDays}
          onChange={(e) => setNetDays(e.target.value)}
          disabled={pending || cadence === "monthly_in_arrears"}
        />
        <Input
          label="Hold / refund period (days)"
          value={holdDays}
          onChange={(e) => setHoldDays(e.target.value)}
          disabled={pending}
        />
        <Input
          label="Minimum payout ($)"
          value={minPayout}
          onChange={(e) => setMinPayout(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="mt-4">
        <div
          className="mb-2 text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Excluded revenue
        </div>
        <div className="flex flex-col gap-2">
          {ALL_REVENUE_EXCLUSIONS.map((id) => (
            <Checkbox
              key={id}
              checked={exclude.includes(id)}
              onChange={(checked) => toggleExclude(id, checked)}
            >
              {EXCLUSION_LABELS[id]}
            </Checkbox>
          ))}
        </div>
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

      <div className="mt-4">
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Saving…" : `Save ${programLabel(initial.program)} defaults`}
        </Button>
      </div>
    </div>
  );
}

export function CommissionDefaultsForm({
  rules,
}: {
  rules: GlobalCommissionRule[];
}) {
  return (
    <AdminDetailSection title="Default commission rules" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Default rates for Academy, Whitby, and Enterprise.
      </p>
      <div className="flex flex-col gap-5">
        {rules.map((rule) => (
          <RuleEditor key={rule.program} initial={rule} />
        ))}
      </div>
    </AdminDetailSection>
  );
}

export function AttributionPlatformForm({
  initial,
}: {
  initial: PlatformAttributionConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cookieDays, setCookieDays] = useState(
    String(initial.defaultCookieLifeDays),
  );
  const [mode, setMode] = useState(initial.attributionMode);
  const [refundRule, setRefundRule] = useState(initial.defaultRefundRule);
  const [eligibility, setEligibility] = useState<ConversionEligibility>(
    initial.conversionEligibility,
  );
  const [fpEnabled, setFpEnabled] = useState(initial.firstpromoterEnabled);
  const [fpAccount, setFpAccount] = useState(
    initial.firstpromoterAccountId ?? "",
  );

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await savePlatformAttributionConfigAction({
        defaultCookieLifeDays: Number(cookieDays),
        attributionMode: mode,
        defaultRefundRule: refundRule,
        conversionEligibility: eligibility,
        firstpromoterEnabled: fpEnabled,
        firstpromoterAccountId: fpAccount || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  return (
    <AdminDetailSection title="Attribution & conversion" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Cookie life, touch mode, and conversion rules.
      </p>

      <div className="grid max-w-[520px] gap-3 sm:grid-cols-2">
        <Input
          label="Default cookie life (days)"
          value={cookieDays}
          onChange={(e) => setCookieDays(e.target.value)}
          disabled={pending}
        />
        <label className="block text-[13px]">
          <span style={{ color: "var(--text-tertiary)" }}>Attribution mode</span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={mode}
            disabled={pending}
            onChange={(e) =>
              setMode(e.target.value as "first_touch" | "last_touch")
            }
          >
            <option value="first_touch">First touch</option>
            <option value="last_touch">Last touch</option>
          </select>
        </label>
        <label className="block text-[13px] sm:col-span-2">
          <span style={{ color: "var(--text-tertiary)" }}>
            Default refund / chargeback rule
          </span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={refundRule}
            disabled={pending}
            onChange={(e) =>
              setRefundRule(
                e.target.value as PlatformAttributionConfig["defaultRefundRule"],
              )
            }
          >
            <option value="proportional">Proportional partial adjustment</option>
            <option value="full">Full reversal</option>
            <option value="future_negative_after_payout">
              Future negative adjustment after payout
            </option>
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div
            className="mb-2 text-[12.5px] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Academy commissionable events
          </div>
          <Checkbox
            checked={eligibility.academy.paid_enrollment}
            onChange={(checked) =>
              setEligibility((e) => ({
                ...e,
                academy: { ...e.academy, paid_enrollment: checked },
              }))
            }
          >
            Paid enrollment
          </Checkbox>
          <div className="mt-2">
            <Checkbox
              checked={eligibility.academy.free_enrollment}
              onChange={(checked) =>
                setEligibility((e) => ({
                  ...e,
                  academy: { ...e.academy, free_enrollment: checked },
                }))
              }
            >
              Free enrollment
            </Checkbox>
          </div>
        </div>
        <div>
          <div
            className="mb-2 text-[12.5px] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--text-tertiary)" }}
          >
            Whitby commissionable events
          </div>
          <Checkbox
            checked={eligibility.platform.first_paid_subscription}
            onChange={(checked) =>
              setEligibility((e) => ({
                ...e,
                platform: { ...e.platform, first_paid_subscription: checked },
              }))
            }
          >
            First paid subscription
          </Checkbox>
          <div className="mt-2">
            <Checkbox
              checked={eligibility.platform.trial}
              onChange={(checked) =>
                setEligibility((e) => ({
                  ...e,
                  platform: { ...e.platform, trial: checked },
                }))
              }
            >
              Trial
            </Checkbox>
          </div>
          <div className="mt-2">
            <Checkbox
              checked={eligibility.platform.account_creation}
              onChange={(checked) =>
                setEligibility((e) => ({
                  ...e,
                  platform: { ...e.platform, account_creation: checked },
                }))
              }
            >
              Account creation
            </Checkbox>
          </div>
        </div>
      </div>

      <div className="mt-5 max-w-[420px]">
        <Checkbox
          checked={fpEnabled}
          onChange={setFpEnabled}
        >
          Enable FirstPromoter integration
        </Checkbox>
        <div className="mt-3">
          <Input
            label="FirstPromoter account ID"
            value={fpAccount}
            onChange={(e) => setFpAccount(e.target.value)}
            disabled={pending || !fpEnabled}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-[13px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      ) : null}

      <div className="mt-5">
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Saving…" : "Save attribution config"}
        </Button>
      </div>
    </AdminDetailSection>
  );
}
