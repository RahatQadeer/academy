"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { createAdminReferralAction } from "@/super-admin/partner-center/actions";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import type { AdminPartnerOption } from "@/super-admin/partner-center/types";

export function ReferralCreateForm({
  partners,
}: {
  partners: AdminPartnerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState("");
  const [program, setProgram] = useState<"academy" | "whitbyos">("academy");
  const [email, setEmail] = useState("");
  const [referredUserId, setReferredUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [reason, setReason] = useState("");

  function submit() {
    setError(null);
    setMessage(null);
    if (!partnerId) {
      setError("Select a partner.");
      return;
    }
    if (!email.trim() && !referredUserId.trim()) {
      setError("Provide a referred user id or email.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Enter a reason for creating this referral.");
      return;
    }

    startTransition(async () => {
      const result = await createAdminReferralAction({
        partnerProfileId: partnerId,
        program,
        reason,
        email: email.trim() || undefined,
        referredUserId: referredUserId.trim() || undefined,
        fullName: fullName.trim() || undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Referral created.");
      setPartnerId("");
      setEmail("");
      setReferredUserId("");
      setFullName("");
      setReason("");
      if (result.referralId) {
        router.push(PC_ADMIN.referral(result.referralId));
        return;
      }
      router.refresh();
    });
  }

  return (
    <AdminDetailSection title="Referral details" variant="form">
      <label
        className="mb-1 block text-[12.5px] font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        Partner
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
        {partners.map((partner) => (
          <option key={partner.id} value={partner.id}>
            {partner.companyName}
          </option>
        ))}
      </select>

      <label
        className="mb-1 block text-[12.5px] font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        Program
      </label>
      <select
        className="mb-4 w-full rounded-[8px] px-3 py-2 text-[14px]"
        style={{
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--ink)",
        }}
        value={program}
        disabled={pending}
        onChange={(event) =>
          setProgram(event.target.value as "academy" | "whitbyos")
        }
      >
        <option value="academy">Academy</option>
        <option value="whitbyos">Whitby</option>
      </select>

      <Input
        label="Referred email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="person@example.com"
        disabled={pending}
      />
      <div className="mt-3">
        <Input
          label="Referred user id (optional if email matches)"
          value={referredUserId}
          onChange={(event) => setReferredUserId(event.target.value)}
          placeholder="uuid"
          disabled={pending}
        />
      </div>
      <div className="mt-3">
        <Input
          label="Full name (optional)"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          disabled={pending}
        />
      </div>
      <div className="mt-3">
        <Input
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is attribution being created?"
          disabled={pending}
        />
      </div>
      <div className="mt-4">
        <Button
          type="button"
          variant="primary"
          disabled={pending || partners.length === 0}
          onClick={submit}
        >
          Create referral
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
