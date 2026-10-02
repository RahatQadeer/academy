"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { extendOpportunityProtectionAction } from "@/super-admin/partner-center/actions";
import {
  AdminDetailSection,
  AdminFormGrid,
} from "@/super-admin/partner-center/components/AdminDetailSections";

/** YYYY-MM-DD for local calendar day after `iso` (or after today if null/invalid). */
function minExtendDate(currentProtectedUntil: string | null): string {
  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let floor = tomorrow;
  if (currentProtectedUntil) {
    const current = new Date(currentProtectedUntil);
    if (!Number.isNaN(current.getTime())) {
      const dayAfter = new Date(current);
      dayAfter.setHours(0, 0, 0, 0);
      dayAfter.setDate(dayAfter.getDate() + 1);
      if (dayAfter > floor) floor = dayAfter;
    }
  }

  const y = floor.getFullYear();
  const m = String(floor.getMonth() + 1).padStart(2, "0");
  const d = String(floor.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function OpportunityExtendProtection({
  opportunityId,
  currentProtectedUntil,
}: {
  opportunityId: string;
  currentProtectedUntil: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const minDate = minExtendDate(currentProtectedUntil);
  const [protectedUntil, setProtectedUntil] = useState(minDate);
  const [reason, setReason] = useState("");

  function submit() {
    setError(null);
    setMessage(null);
    if (!protectedUntil) {
      setError("Choose a new protected-until date.");
      return;
    }
    if (protectedUntil < minDate) {
      setError("Protected-until must be after the current protection end.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Enter a reason for the extension.");
      return;
    }

    startTransition(async () => {
      const result = await extendOpportunityProtectionAction({
        opportunityId,
        protectedUntil: `${protectedUntil}T23:59:59.000Z`,
        reason,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage("Protection period updated.");
      setReason("");
      router.refresh();
    });
  }

  return (
    <AdminDetailSection title="Extend protection" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Change the protected-until date. Extensions are audited.
      </p>
      <AdminFormGrid>
        <Input
          label="Protected until"
          type="date"
          min={minDate}
          value={protectedUntil}
          onChange={(event) => setProtectedUntil(event.target.value)}
          disabled={pending}
        />
        <Input
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is protection being extended?"
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
          Save extension
        </Button>
      </div>
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
