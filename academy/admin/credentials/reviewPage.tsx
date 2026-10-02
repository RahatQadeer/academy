import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import {
  credentialVerifyPath,
} from "@/academy/credentials/utils/publicId";
import { CertificationChecklist } from "./components/CertificationChecklist";
import { CredentialsSkeleton } from "./components/CredentialsSkeleton";
import { ReviewSideCards } from "./components/ReviewSideCards";
import { ReviewSubmissionsPanel } from "./components/ReviewSubmissionsPanel";
import { credentialKindLabel, formatCredentialDate } from "./lib/format";
import { loadAdminCredentialReview } from "./services/loadAdminCredentialReview";

async function ReviewBody({ credentialId }: { credentialId: string }) {
  const result = await loadAdminCredentialReview(credentialId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Admin access required">
          This area is limited to Academy Admins.
        </Callout>
      </div>
    );
  }

  if (!result.ok && result.reason === "not_found") {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Credential not found">
          This credential could not be opened.
        </Callout>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Credential unavailable">
          This review could not be loaded. Try again in a moment.
        </Callout>
      </div>
    );
  }

  const detail = result.data;
  const completeCount = detail.checklist.filter((item) => item.complete).length;
  const checklistTotal = detail.checklist.length;
  const allComplete = checklistTotal > 0 && completeCount === checklistTotal;
  const canDecide = detail.status === "credential_review";
  const requested = Boolean(detail.certificateRequestedAt);
  const typeLabel = credentialKindLabel(detail.type);
  const verifyHref =
    detail.status === "awarded" && detail.certificateNumber
      ? credentialVerifyPath(detail.certificateNumber)
      : null;

  return (
    <div className="relative px-6 pb-14 pt-10 lg:px-14">
      {/* Decorative wash only — never overflow:hidden on the page root (clips shell scroll). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[280px]"
        style={{
          background:
            "radial-gradient(ellipse 65% 50% at 18% 0%, color-mix(in srgb, var(--accent-tint) 55%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[1080px]">
        <Link
          href="/academy/admin/credentials"
          className="inline-flex items-center gap-1.5 text-[13.5px] no-underline transition-colors hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
        >
          <span aria-hidden className="text-[15px] leading-none">
            ←
          </span>
          Certificates & Credentials
        </Link>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={detail.type === "cpa_credential" ? "accent" : "neutral"}>{typeLabel}</Pill>
            {detail.status === "awarded" ? <Pill tone="success">Awarded</Pill> : null}
            {canDecide && requested ? <Pill tone="accent">Requested</Pill> : null}
            {canDecide && !requested ? <Pill tone="warning">Awaiting request</Pill> : null}
          </div>

          <h1
            className="mt-3.5 max-w-[42rem] text-[26px] font-bold tracking-[-0.4px] text-pretty sm:text-[30px] sm:leading-[1.15]"
            style={{ color: "var(--ink)" }}
          >
            {detail.credentialName}
          </h1>

          <div
            className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-[10px] px-4 py-3.5 sm:px-5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <MetaChip label="Learner" value={detail.learnerName} emphasize />
            <Divider />
            <MetaChip label="Term" value={detail.termLabel} />
            <Divider />
            <MetaChip
              label="Checklist"
              value={
                checklistTotal === 0
                  ? "—"
                  : allComplete
                    ? "Ready to award"
                    : `${completeCount} of ${checklistTotal} complete`
              }
              tone={allComplete ? "success" : undefined}
            />
            {requested ? (
              <>
                <Divider />
                <MetaChip
                  label="Requested"
                  value={formatCredentialDate(detail.certificateRequestedAt)}
                />
              </>
            ) : null}
          </div>

          <p
            className="mt-3.5 max-w-[40rem] text-[13.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Admin award confirms authenticity on Verify. Review the checklist, then award or send
            back with a note.
          </p>
        </header>

        {detail.status === "awarded" ? (
          <div className="mt-6 space-y-3">
            <Callout tone="success" title="Already awarded">
              This credential is already awarded. The learner can view it in Certificates &
              Credentials, and anyone can confirm ownership on Verify.
            </Callout>
            <div
              className="flex flex-col gap-3 rounded-[10px] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="min-w-0">
                <p className="text-[14px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>
                  {detail.expiresAt ? "Public verify & renewal" : "Public verify"}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {detail.expiresAt
                    ? `Expires ${formatCredentialDate(detail.expiresAt)}. Verify authenticity or renew the 3-year term.`
                    : "Confirm authenticity on the public Verify page. This certificate does not expire."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {verifyHref ? (
                  <Button href={verifyHref} variant="primary" className="shrink-0">
                    Verify certificate
                  </Button>
                ) : null}
                {detail.expiresAt ? (
                  <Button
                    href={`/academy/admin/credentials/${detail.id}/awarded`}
                    variant="secondary"
                    className="shrink-0"
                  >
                    Renew certificate
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start">
          <div className="min-w-0 space-y-5">
            <CertificationChecklist items={detail.checklist} />
            <ReviewSubmissionsPanel credentialId={detail.id} submissions={detail.submissions} />
          </div>
          <ReviewSideCards detail={detail} />
        </div>
      </div>
    </div>
  );
}

function MetaChip({
  label,
  value,
  emphasize,
  tone,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  tone?: "success";
}) {
  return (
    <div className="min-w-0">
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-[13.5px] ${emphasize ? "font-semibold" : "font-medium"}`}
        style={{
          color: tone === "success" ? "var(--success-fg)" : "var(--ink)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      className="hidden h-8 w-px shrink-0 sm:block"
      style={{ background: "var(--border)" }}
    />
  );
}

export function AdminCredentialReviewPage({ credentialId }: { credentialId: string }) {
  return (
    <Suspense fallback={<CredentialsSkeleton />}>
      <ReviewBody credentialId={credentialId} />
    </Suspense>
  );
}
