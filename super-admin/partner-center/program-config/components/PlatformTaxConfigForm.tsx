"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { Checkbox } from "@/partner-center/components/Checkbox";
import { savePlatformTaxConfigAction } from "@/super-admin/partner-center/actions";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import type {
  PayoutMethodOption,
  PlatformTaxConfig,
} from "@/super-admin/partner-center/services/platform-tax-config";

const METHOD_LABELS: { id: PayoutMethodOption; label: string }[] = [
  { id: "stripe_connect", label: "Stripe Connect" },
  { id: "quickbooks", label: "QuickBooks" },
  { id: "ach", label: "ACH" },
  { id: "check", label: "Check" },
];

export function PlatformTaxConfigForm({
  initial,
}: {
  initial: PlatformTaxConfig;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [legalPayerEntity, setLegalPayerEntity] = useState(
    initial.legalPayerEntity,
  );
  const [methods, setMethods] = useState<PayoutMethodOption[]>(
    initial.availablePayoutMethods,
  );
  const [taxFormType, setTaxFormType] = useState(initial.taxFormType);
  const [taxCollectionSource, setTaxCollectionSource] = useState(
    initial.taxCollectionSource,
  );

  function toggleMethod(id: PayoutMethodOption, checked: boolean) {
    setMethods((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((m) => m !== id);
    });
  }

  function submit() {
    setError(null);
    setMessage(null);
    if (!legalPayerEntity.trim()) {
      setError("Legal payer entity is required.");
      return;
    }
    if (methods.length === 0) {
      setError("Enable at least one payout method.");
      return;
    }

    startTransition(async () => {
      const result = await savePlatformTaxConfigAction({
        legalPayerEntity,
        availablePayoutMethods: methods,
        taxFormType,
        taxCollectionSource,
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
    <AdminDetailSection title="Tax & payout config" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Payout methods, tax source, and legal payer name.
      </p>

      <div className="max-w-[420px]">
        <Input
          label="Legal payer entity"
          value={legalPayerEntity}
          onChange={(e) => setLegalPayerEntity(e.target.value)}
          disabled={pending}
        />
      </div>

      <div className="mt-5">
        <div
          className="mb-2 text-[12.5px] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Available payout methods
        </div>
        <div className="flex flex-col gap-2">
          {METHOD_LABELS.map((item) => (
            <Checkbox
              key={item.id}
              checked={methods.includes(item.id)}
              onChange={(checked) => toggleMethod(item.id, checked)}
            >
              {item.label}
            </Checkbox>
          ))}
        </div>
      </div>

      <div className="mt-5 grid max-w-[420px] gap-4 sm:grid-cols-2">
        <label className="block text-[13px]">
          <span style={{ color: "var(--text-tertiary)" }}>Tax form type</span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={taxFormType}
            disabled={pending}
            onChange={(e) =>
              setTaxFormType(e.target.value as PlatformTaxConfig["taxFormType"])
            }
          >
            <option value="w9">W-9</option>
            <option value="w8">W-8</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-[13px]">
          <span style={{ color: "var(--text-tertiary)" }}>
            Default collection source
          </span>
          <select
            className="mt-1 w-full rounded-[8px] border border-line bg-white px-3 py-2"
            value={taxCollectionSource}
            disabled={pending}
            onChange={(e) =>
              setTaxCollectionSource(
                e.target.value as PlatformTaxConfig["taxCollectionSource"],
              )
            }
          >
            <option value="stripe_tax">Stripe</option>
            <option value="quickbooks_w9">QuickBooks W-9</option>
            <option value="other">Other</option>
          </select>
        </label>
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
          {pending ? "Saving…" : "Save tax & payout config"}
        </Button>
      </div>
    </AdminDetailSection>
  );
}
