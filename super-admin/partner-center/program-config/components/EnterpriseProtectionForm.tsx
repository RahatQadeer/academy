"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { Textarea } from "@/partner-center/components/Textarea";
import { Checkbox } from "@/partner-center/components/Checkbox";
import { saveEnterpriseProtectionRulesAction } from "@/super-admin/partner-center/actions";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import type { EnterpriseProtectionRules } from "@/super-admin/partner-center/services/saveEnterpriseProtectionRules";

export function EnterpriseProtectionForm({
  initial,
}: {
  initial: EnterpriseProtectionRules;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptanceRequired, setAcceptanceRequired] = useState(
    initial.acceptanceRequired,
  );
  const [protectionPeriodDays, setProtectionPeriodDays] = useState(
    String(initial.protectionPeriodDays),
  );
  const [renewalExtensionNotes, setRenewalExtensionNotes] = useState(
    initial.renewalExtensionNotes,
  );
  const [conflictResolutionNotes, setConflictResolutionNotes] = useState(
    initial.conflictResolutionNotes,
  );

  function submit() {
    setError(null);
    setMessage(null);
    const days = Number(protectionPeriodDays);
    if (!Number.isFinite(days) || days < 1) {
      setError("Enter a valid protection period in days.");
      return;
    }

    startTransition(async () => {
      const result = await saveEnterpriseProtectionRulesAction({
        acceptanceRequired,
        protectionPeriodDays: days,
        renewalExtensionNotes,
        conflictResolutionNotes,
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
    <AdminDetailSection title="Enterprise protection rules" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Sets acceptance and the protection window for new opportunities.
      </p>
      <Checkbox checked={acceptanceRequired} onChange={setAcceptanceRequired}>
        Require acceptance before In Progress
      </Checkbox>
      <div className="mt-4 max-w-[240px]">
        <Input
          label="Protection period (days)"
          inputMode="numeric"
          value={protectionPeriodDays}
          onChange={(e) => setProtectionPeriodDays(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="mt-4">
        <Textarea
          label="Renewal / extension policy notes"
          value={renewalExtensionNotes}
          onChange={(e) => setRenewalExtensionNotes(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="mt-4">
        <Textarea
          label="Conflict resolution notes"
          value={conflictResolutionNotes}
          onChange={(e) => setConflictResolutionNotes(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="mt-4">
        <Button type="button" variant="primary" disabled={pending} onClick={submit}>
          {pending ? "Saving…" : "Save rules"}
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
