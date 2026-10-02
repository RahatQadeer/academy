"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { correctOpportunityAttributionAction } from "@/super-admin/partner-center/actions";
import {
  AdminDetailSection,
  AdminFormGrid,
} from "@/super-admin/partner-center/components/AdminDetailSections";
import type { AdminPartnerOption } from "@/super-admin/partner-center/types";

export function OpportunityCorrectAttribution({
  opportunityId,
  currentPartnerProfileId,
  currentPartnerLabel,
  partners,
  disabled,
}: {
  opportunityId: string;
  currentPartnerProfileId: string;
  currentPartnerLabel: string;
  partners: AdminPartnerOption[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [reason, setReason] = useState("");

  const currentId = currentPartnerProfileId.trim();
  const options = partners.filter((p) => p.id.trim() !== currentId);

  function submit() {
    setError(null);
    setMessage(null);
    if (!partnerId) {
      setError("Select the correct partner.");
      return;
    }
    if (partnerId === currentId) {
      setError("Choose a different partner than the current attribution.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Enter a reason for the correction.");
      return;
    }

    startTransition(async () => {
      const result = await correctOpportunityAttributionAction({
        opportunityId,
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
        Reassign this opportunity to another partner. The change is audited.
      </p>
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Current:{" "}
        <strong style={{ color: "var(--ink)" }}>
          {currentPartnerLabel || "—"}
        </strong>
      </p>
      {disabled ? (
        <p className="text-[13px]" style={{ color: "#a8433b" }}>
          Paid earnings block reassignment until those payouts are reversed.
        </p>
      ) : options.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
          No other partners available to reassign to.
        </p>
      ) : (
        <>
          <AdminFormGrid>
            <label className="block">
              <span
                className="mb-1.5 block text-[12.5px] font-medium"
                style={{ color: "var(--text-tertiary)" }}
              >
                New partner
              </span>
              <select
                className="w-full rounded-control border border-line-strong bg-surface py-[9px] pl-3 pr-3 text-[14.5px] text-ink"
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
            </label>
            <Input
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is attribution changing?"
              disabled={pending}
            />
          </AdminFormGrid>
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
        <p
          className="mt-3 text-[13px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {message}
        </p>
      ) : null}
    </AdminDetailSection>
  );
}
