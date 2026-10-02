"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { correctReferralAttributionAction } from "@/super-admin/partner-center/actions";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import type { AdminPartnerOption } from "@/super-admin/partner-center/types";

export function ReferralCorrectAttribution({
  referralId,
  currentPartnerProfileId,
  partners,
  disabled,
}: {
  referralId: string;
  currentPartnerProfileId: string;
  partners: AdminPartnerOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [reason, setReason] = useState("");

  const options = partners.filter((p) => p.id !== currentPartnerProfileId);

  function submit() {
    setError(null);
    setMessage(null);
    if (!partnerId) {
      setError("Select the correct partner.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Enter a reason for the correction.");
      return;
    }

    startTransition(async () => {
      const result = await correctReferralAttributionAction({
        referralId,
        newPartnerProfileId: partnerId,
        reason,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Attribution corrected.");
      setPartnerId("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <AdminDetailSection title="Correct attribution" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Reassign this referral to another partner. The change is audited.
      </p>
      {disabled ? (
        <p className="text-[13px]" style={{ color: "#a8433b" }}>
          This referral has paid earnings and cannot be reassigned until those
          payouts are reversed.
        </p>
      ) : (
        <>
          <label className="mb-1 block text-[12.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
            New partner
          </label>
          <select
            className="mb-4 w-full rounded-[8px] px-3 py-2 text-[14px]"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
            value={partnerId}
            disabled={pending}
            onChange={(event) => setPartnerId(event.target.value)}
          >
            <option value="">Select partner…</option>
            {options.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.companyName}
              </option>
            ))}
          </select>
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is attribution changing?"
            disabled={pending}
          />
          <div className="mt-4">
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={submit}
            >
              Save correction
            </Button>
          </div>
        </>
      )}
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
