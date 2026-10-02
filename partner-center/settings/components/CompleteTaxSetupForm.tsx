"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { FormError } from "@/base/components/AuthControls";
import { cn } from "@/base/lib/cn";
import { PARTNER_PATHS } from "@/partner-center/lib/review-state";
import {
  routeTaxToReview,
  saveSettingsTaxProfile,
} from "@/partner-center/settings/lib/tax-actions";
import type { TaxProfileRow } from "@/partner-center/settings/lib/load-tax-payment";
import { PartnerChrome } from "@/partner-center/components/PartnerChrome";
import { Select } from "@/partner-center/components/Select";
import { usePartnerAction } from "@/partner-center/lib/use-partner-action";

const CLASSIFICATIONS = [
  "Individual / sole proprietor",
  "C Corporation",
  "S Corporation",
  "Partnership",
  "Trust / estate",
  "LLC — Single member",
  "LLC — C Corp",
  "LLC — S Corp",
  "LLC — Partnership",
  "Other",
];

type Residency = "w9" | "w8" | "unsure";

function RadioCard({
  selected,
  title,
  onSelect,
}: {
  selected: boolean;
  title: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-[8px] border px-4 py-3 text-left text-[13.5px] font-medium transition-colors",
        selected ? "font-semibold" : "font-normal",
      )}
      style={{
        borderColor: selected ? "var(--accent)" : "var(--border)",
        background: selected ? "var(--accent-tint-mid)" : "white",
        color: selected ? "var(--accent-hover)" : "var(--ink)",
      }}
    >
      {title}
    </button>
  );
}

export function CompleteTaxSetupForm({
  tax,
  companyName,
}: {
  tax: TaxProfileRow | null;
  companyName: string;
}) {
  const router = useRouter();
  const { runAction } = usePartnerAction();
  const initialResidency: Residency =
    tax?.form_type === "w8"
      ? "w8"
      : tax?.status === "review_required"
        ? "unsure"
        : "w9";

  const [residency, setResidency] = useState<Residency>(initialResidency);
  const [legalName, setLegalName] = useState(
    tax?.legal_payee_name || companyName || "",
  );
  const [dba, setDba] = useState(tax?.business_dba_name || "");
  const [classification, setClassification] = useState(
    tax?.entity_classification || "",
  );
  const [address, setAddress] = useState(tax?.mailing_address || "");
  const [country, setCountry] = useState(
    tax?.country || (initialResidency === "w9" ? "US" : ""),
  );
  const [certified, setCertified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const tinDisplay =
    tax?.tin_last4 && tax.tin_last4.trim()
      ? `••••••${tax.tin_last4.trim()}`
      : "••••••••";

  async function run(mode: "draft" | "submit") {
    if (mode === "submit" && residency !== "unsure" && !certified) {
      setError("Confirm the certification before submitting.");
      return;
    }

    setPending(true);
    setError(null);

    if (residency === "unsure") {
      const result = await runAction(() => routeTaxToReview(), {
        supportOnly: true,
        onRetry: () => void run(mode),
      });
      setPending(false);
      if (result.error) return;
      router.push(result.redirect || PARTNER_PATHS.settingsTax);
      router.refresh();
      return;
    }

    const result = await runAction(
      () =>
        saveSettingsTaxProfile({
          residency,
          legal_payee_name: legalName,
          business_dba_name: dba,
          entity_classification: classification,
          mailing_address: address,
          country,
          mode,
        }),
      { onValidationError: setError, onRetry: () => void run(mode) },
    );
    setPending(false);
    if (result.error) return;
    router.push(result.redirect || PARTNER_PATHS.settingsTax);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <PartnerChrome
        title="Complete Tax Setup"
        subtitle="One current tax profile covers all your payouts under Private Attaché, regardless of payout rail."
      />
      <Link
        href={PARTNER_PATHS.settingsTax}
        className="mb-6 inline-block text-[13px] font-semibold no-underline"
        style={{ color: "var(--ink)" }}
      >
        ← Back to Tax & Payment Profile
      </Link>

      <div className="mb-5">
        <div
          className="mb-2.5 text-[13px] font-medium"
          style={{ color: "rgba(55,53,47,.75)" }}
        >
          Are you a U.S. person or entity for tax purposes?
        </div>
        <div className="space-y-2">
          <RadioCard
            selected={residency === "w9"}
            title="Yes — I'll complete a W-9"
            onSelect={() => {
              setResidency("w9");
              if (!country) setCountry("US");
            }}
          />
          <RadioCard
            selected={residency === "w8"}
            title="No — I'll complete the appropriate W-8"
            onSelect={() => setResidency("w8")}
          />
          <RadioCard
            selected={residency === "unsure"}
            title="Not sure — route to review"
            onSelect={() => setResidency("unsure")}
          />
        </div>
      </div>

      {residency !== "unsure" ? (
        <div className="rounded-[10px] border border-line bg-white p-5">
          <div className="mb-4 text-[14px] font-semibold">
            {residency === "w9"
              ? "Form W-9 — Request for Taxpayer Identification"
              : "Form W-8 — Foreign status certification"}
          </div>
          <div className="space-y-4">
            <Input
              label="Legal name"
              name="legal_payee_name"
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              required
            />
            <Input
              label="Business / DBA name (optional)"
              name="business_dba_name"
              value={dba}
              onChange={(event) => setDba(event.target.value)}
              placeholder="Same as legal name"
            />
            <Select
              label="Federal tax classification"
              id="entity_classification"
              name="entity_classification"
              value={classification}
              onChange={(event) => setClassification(event.target.value)}
            >
              <option value="">Select classification</option>
              {CLASSIFICATIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <Input
              label="Mailing address"
              name="mailing_address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
            />
            <Input
              label="Country"
              name="country"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              required
            />
            <div>
              <label
                htmlFor="tin_display"
                className="mb-1.5 block text-[12.5px] font-medium"
                style={{ color: "rgba(55,53,47,.5)" }}
              >
                Taxpayer identification number (TIN)
              </label>
              <input
                id="tin_display"
                type="password"
                readOnly
                value={tinDisplay}
                className="w-full cursor-default rounded-[6px] border border-line bg-[#f7f7f5] px-3 py-2.5 text-[14px]"
                tabIndex={-1}
              />
              <p
                className="mt-1.5 mb-0 text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Collected and stored securely by Stripe. Only the last four
                digits are ever shown here.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-[10px] border border-line bg-white px-5 py-4 text-[13.5px] leading-[1.5]"
          style={{ color: "rgba(55,53,47,.75)" }}
        >
          We&apos;ll route your account for staff review instead of guessing a
          form type. You can keep referring; payouts stay blocked until review
          finishes.
        </div>
      )}

      {residency !== "unsure" ? (
        <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[13px] leading-[1.45]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={certified}
            onChange={(event) => setCertified(event.target.checked)}
          />
          <span>
            Under penalties of perjury, I certify that the information above is
            true, correct, and complete.
          </span>
        </label>
      ) : null}

      <FormError message={error} />

      <div className="mt-6 flex items-center justify-between gap-3">
        {residency === "unsure" ? (
          <>
            <Button href={PARTNER_PATHS.settingsTax} variant="ghost">
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => void run("draft")}
            >
              {pending ? "Submitting…" : "Submit for review"}
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => void run("draft")}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13.5px] font-semibold"
              style={{ color: "rgba(55,53,47,.65)" }}
            >
              Save & finish later
            </button>
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => void run("submit")}
            >
              {pending
                ? "Submitting…"
                : residency === "w9"
                  ? "Submit W-9"
                  : "Submit W-8"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
