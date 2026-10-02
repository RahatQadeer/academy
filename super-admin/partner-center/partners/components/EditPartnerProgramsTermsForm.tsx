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
import { savePartnerProgramsAndTermsAction } from "@/super-admin/partner-center/actions";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import type {
  PartnerProgramsAndTermsLoad,
  PartnerRuleEdit,
} from "@/super-admin/partner-center/services/savePartnerProgramsAndTerms";
import type { CommissionProgramFamily } from "@/super-admin/partner-center/services/saveCommissionDefaults";

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
  { value: "unlimited", label: "Unlimited" },
];

function programLabel(program: string) {
  if (program === "academy") return "Academy";
  if (program === "platform") return "Whitby";
  return "Enterprise";
}

export function EditPartnerProgramsTermsForm({
  initial,
}: {
  initial: PartnerProgramsAndTermsLoad;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [programs, setPrograms] = useState(initial.programs);
  const [rules, setRules] = useState(initial.rules);
  const [cookieLifeDays, setCookieLifeDays] = useState(
    String(initial.cookieLifeDays),
  );
  const [promoterId, setPromoterId] = useState(
    initial.firstpromoter.promoterId,
  );
  const [campaignId, setCampaignId] = useState(
    initial.firstpromoter.campaignId,
  );
  const [fpProgram, setFpProgram] = useState<CommissionProgramFamily | "">(
    initial.firstpromoter.program,
  );

  function updateRule(
    program: CommissionProgramFamily,
    patch: Partial<PartnerRuleEdit>,
  ) {
    setRules((prev) =>
      prev.map((rule) =>
        rule.program === program ? { ...rule, ...patch } : rule,
      ),
    );
  }

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await savePartnerProgramsAndTermsAction({
        partnerProfileId: initial.partnerProfileId,
        programs,
        rules,
        cookieLifeDays: Number(cookieLifeDays),
        firstpromoter: {
          promoterId,
          campaignId,
          program: fpProgram,
        },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminDetailSection title="Programs" variant="form">
        <div className="flex flex-col gap-3">
          {programs.map((program) => (
            <div
              key={program.program}
              className="flex flex-wrap items-center gap-4"
            >
              <Checkbox
                checked={program.active}
                onChange={(checked) =>
                  setPrograms((prev) =>
                    prev.map((row) =>
                      row.program === program.program
                        ? { ...row, active: checked }
                        : row,
                    ),
                  )
                }
              >
                {programLabel(program.program)} active
              </Checkbox>
            </div>
          ))}
        </div>
      </AdminDetailSection>

      <AdminDetailSection title="Referral cookie life" variant="form">
        <div className="max-w-[240px]">
          <Input
            label="Cookie life (days)"
            value={cookieLifeDays}
            onChange={(e) => setCookieLifeDays(e.target.value)}
            disabled={pending}
          />
        </div>
      </AdminDetailSection>

      <AdminDetailSection title="FirstPromoter mapping" variant="form">
        <div className="grid max-w-[520px] gap-3 sm:grid-cols-2">
          <Input
            label="Promoter ID"
            value={promoterId}
            onChange={(e) => setPromoterId(e.target.value)}
            disabled={pending}
          />
          <Input
            label="Campaign ID"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            disabled={pending}
          />
          <label className="block text-[13px]">
            <span style={{ color: "var(--text-tertiary)" }}>Program</span>
            <select
              className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
              value={fpProgram}
              disabled={pending}
              onChange={(e) =>
                setFpProgram(
                  e.target.value as CommissionProgramFamily | "",
                )
              }
            >
              <option value="">Any</option>
              <option value="academy">Academy</option>
              <option value="platform">Whitby</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>
        </div>
      </AdminDetailSection>

      {rules.map((rule) => (
        <AdminDetailSection
          key={rule.program}
          title={`${programLabel(rule.program)} terms override`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px]">
              <span style={{ color: "var(--text-tertiary)" }}>Rate type</span>
              <select
                className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
                value={rule.rateType}
                disabled={pending}
                onChange={(e) =>
                  updateRule(rule.program, {
                    rateType: e.target.value as "percentage" | "flat",
                  })
                }
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
              </select>
            </label>
            <Input
              label={rule.rateType === "flat" ? "Flat ($)" : "Rate (%)"}
              value={String(rule.rateValue)}
              onChange={(e) =>
                updateRule(rule.program, {
                  rateValue: Number(e.target.value),
                })
              }
              disabled={pending}
            />
            <label className="block text-[13px]">
              <span style={{ color: "var(--text-tertiary)" }}>
                Earning basis
              </span>
              <select
                className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
                value={rule.earningBasis}
                disabled={pending}
                onChange={(e) =>
                  updateRule(rule.program, { earningBasis: e.target.value })
                }
              >
                {BASIS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[13px]">
              <span style={{ color: "var(--text-tertiary)" }}>
                Eligible period
              </span>
              <select
                className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
                value={rule.eligiblePeriod}
                disabled={pending}
                onChange={(e) =>
                  updateRule(rule.program, { eligiblePeriod: e.target.value })
                }
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
              value={String(rule.attributionWindowDays)}
              onChange={(e) =>
                updateRule(rule.program, {
                  attributionWindowDays: Number(e.target.value),
                })
              }
              disabled={pending}
            />
            <Input
              label="Waiting period (days)"
              value={String(rule.newCustomerPeriodDays)}
              onChange={(e) =>
                updateRule(rule.program, {
                  newCustomerPeriodDays: Number(e.target.value),
                })
              }
              disabled={pending}
            />
            <Input
              label="Net days"
              value={String(rule.paymentTerms.netDays)}
              onChange={(e) =>
                updateRule(rule.program, {
                  paymentTerms: {
                    ...rule.paymentTerms,
                    netDays: Number(e.target.value) || 0,
                    display: `Net ${Number(e.target.value) || 0}`,
                  },
                })
              }
              disabled={pending}
            />
            <Input
              label="Hold days"
              value={String(rule.paymentTerms.holdDays)}
              onChange={(e) =>
                updateRule(rule.program, {
                  paymentTerms: {
                    ...rule.paymentTerms,
                    holdDays: Number(e.target.value) || 0,
                  },
                })
              }
              disabled={pending}
            />
            <Input
              label="Min payout ($)"
              value={String(rule.paymentTerms.minPayoutDollars)}
              onChange={(e) =>
                updateRule(rule.program, {
                  paymentTerms: {
                    ...rule.paymentTerms,
                    minPayoutDollars: Number(e.target.value) || 0,
                  } satisfies PaymentTermsConfig,
                })
              }
              disabled={pending}
            />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {ALL_REVENUE_EXCLUSIONS.map((id) => (
              <Checkbox
                key={id}
                checked={rule.excludeRevenue.includes(id)}
                onChange={(checked) => {
                  const excludeRevenue: RevenueComponent[] = checked
                    ? rule.excludeRevenue.includes(id)
                      ? rule.excludeRevenue
                      : [...rule.excludeRevenue, id]
                    : rule.excludeRevenue.filter((x) => x !== id);
                  updateRule(rule.program, { excludeRevenue });
                }}
              >
                Exclude {id.replace("_", " ")}
              </Checkbox>
            ))}
          </div>
        </AdminDetailSection>
      ))}

      {error ? (
        <p className="text-[13px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      ) : null}

      <Button
        type="button"
        variant="primary"
        disabled={pending}
        onClick={submit}
      >
        {pending ? "Saving…" : "Save programs & terms"}
      </Button>
    </div>
  );
}
