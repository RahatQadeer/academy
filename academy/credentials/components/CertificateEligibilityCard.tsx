"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { ProgressBar } from "@/base/components/ProgressBar";
import { requestCertificateAction } from "../actions";
import type { CredentialDetailData } from "../types/detail";

function formatRequestedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function CertificateEligibilityCard({ data }: { data: CredentialDetailData }) {
  const router = useRouter();
  const { assignmentEligibility: eligibility, status, certificateRequestedAt } = data;
  const awarded = status === "awarded";
  const hasAssignments = eligibility.total > 0;
  const eligible = awarded || (!eligibility.locked && status === "credential_review");
  const pendingReview = hasAssignments && eligibility.submitted > eligibility.reviewed;

  const [error, setError] = useState<string | null>(null);
  const [localRequestedAt, setLocalRequestedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const requestedAt = localRequestedAt ?? certificateRequestedAt;
  const showRequested = Boolean(requestedAt) && !awarded;
  const canRequest = eligible && !awarded && !requestedAt;
  const requestedLabel = requestedAt ? formatRequestedAt(requestedAt) : null;

  function requestCertificate() {
    startTransition(async () => {
      setError(null);
      const result = await requestCertificateAction(data.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setLocalRequestedAt(result.requestedAt ?? new Date().toISOString());
      router.refresh();
    });
  }

  return (
    <section
      className="overflow-hidden rounded-[12px] border bg-surface"
      style={{ borderColor: "var(--border)" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
        style={{
          background: awarded || eligible || showRequested ? "var(--success-bg)" : "var(--surface-soft)",
          color: awarded || eligible || showRequested ? "var(--success-fg)" : "var(--ink)",
        }}
      >
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em]">Certificate</p>
          <p className="mt-1 text-[18px] font-semibold tracking-[-0.3px]">
            {awarded ? "Issued" : showRequested ? "Requested" : eligible ? "Eligible" : "Locked"}
          </p>
        </div>
        <span className="text-[22px]" aria-hidden>
          {awarded || eligible || showRequested ? "✅" : "🔒"}
        </span>
      </div>

      <div className="space-y-4 px-5 py-4">
        {hasAssignments ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Assignments submitted"
                value={`${eligibility.submitted}/${eligibility.total}`}
              />
              <Stat
                label="Assignments reviewed"
                value={`${eligibility.reviewed}/${eligibility.total}`}
              />
            </div>
            <ProgressBar
              value={
                eligibility.total === 0
                  ? 0
                  : Math.round((eligibility.reviewed / eligibility.total) * 100)
              }
              tone={eligibility.reviewed >= eligibility.total ? "success" : "default"}
            />
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            This course has no required assignments. Certificate eligibility follows course
            completion.
          </p>
        )}

        {!awarded && eligibility.locked && eligibility.lockReason ? (
          <Callout tone="warning" title="Certificate locked">
            {eligibility.lockReason}
          </Callout>
        ) : null}

        {/* Keep this panel mounted for both ready + requested so the card never “vanishes”. */}
        {!awarded && (canRequest || showRequested) ? (
          <div className="space-y-3">
            {canRequest ? (
              <>
                <Callout tone="success" title="Ready to request">
                  All course requirements are complete
                  {hasAssignments ? ", including instructor review of every assignment" : ""}.
                  Request your certificate — Academy Admin will issue it from Credentials.
                </Callout>
                <Button
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={pending}
                  onClick={requestCertificate}
                >
                  {pending ? "Submitting request…" : "Request certificate"}
                </Button>
              </>
            ) : (
              <>
                <Callout tone="success" title="Certificate requested">
                  Your request is with Academy Admin
                  {requestedLabel ? ` (sent ${requestedLabel})` : ""}. They typically issue
                  certificates within 5 business days. This card stays here until your certificate
                  is awarded.
                </Callout>
                <Button type="button" variant="secondary" className="w-full" disabled>
                  Request submitted
                </Button>
              </>
            )}
            {error ? (
              <p className="text-[13px]" style={{ color: "var(--danger-fg)" }}>
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {!awarded && pendingReview && !eligible ? (
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
            You can keep learning while assignments are under review. The certificate stays locked
            until every required assignment has been graded.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[11.5px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-[-0.4px]">{value}</p>
    </div>
  );
}
