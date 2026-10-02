import { Suspense } from "react";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import {
  credentialVerifyPath,
} from "@/academy/credentials/utils/publicId";
import { CredentialsSkeleton } from "./components/CredentialsSkeleton";
import { RenewCredentialButton } from "./components/RenewCredentialButton";
import { credentialKindLabel, formatCredentialDate } from "./lib/format";
import { loadAdminCredentialReview } from "./services/loadAdminCredentialReview";

async function AwardedBody({ credentialId }: { credentialId: string }) {
  const result = await loadAdminCredentialReview(credentialId);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <div className="px-5 py-8 sm:px-7 lg:px-10">
        <Callout tone="warning" title="Admin access required">
          This area is limited to Academy Admins.
        </Callout>
      </div>
    );
  }

  if (!result.ok) {
    return (
      <div className="px-5 py-8 sm:px-7 lg:px-10">
        <Callout tone="warning" title="Credential unavailable">
          This award confirmation could not be loaded.
        </Callout>
      </div>
    );
  }

  const detail = result.data;
  if (detail.status !== "awarded") {
    return (
      <div className="px-5 py-8 sm:px-7 lg:px-10">
        <Callout tone="warning" title="Not awarded yet">
          This credential has not been awarded.
        </Callout>
      </div>
    );
  }

  const typeLabel = credentialKindLabel(detail.type);
  const awardedLabel = formatCredentialDate(detail.awardedAt);
  const expiresLabel = detail.expiresAt ? formatCredentialDate(detail.expiresAt) : null;
  const verifyHref = detail.certificateNumber
    ? credentialVerifyPath(detail.certificateNumber)
    : undefined;

  return (
    <div className="relative px-5 py-8 sm:px-7 lg:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[220px]"
        style={{
          background:
            "radial-gradient(ellipse 55% 70% at 12% 0%, color-mix(in srgb, var(--success-bg) 55%, transparent), transparent 72%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[760px]">
        <div className="flex items-start gap-4">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--success-bg)",
              color: "var(--success-fg)",
              boxShadow: "0 0 0 4px color-mix(in srgb, var(--success-bg) 50%, transparent)",
            }}
            aria-hidden
          >
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path
                d="M8 16.5 13.2 21.5 24 10.5"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <p
              className="text-[11.5px] font-semibold uppercase tracking-[0.07em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Certificates & Credentials
            </p>
            <h1
              className="mt-1 text-[24px] font-bold tracking-[-0.35px] text-pretty sm:text-[26px]"
              style={{ color: "var(--ink)" }}
            >
              Certificate awarded
            </h1>
            <p
              className="mt-1.5 max-w-[40rem] text-[14px] leading-relaxed text-pretty"
              style={{ color: "var(--text-secondary)" }}
            >
              The credential is live for the learner and can be confirmed publicly on Verify.
            </p>
          </div>
        </div>

        <article
          className="mt-6 w-full overflow-hidden rounded-[12px] text-left"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between gap-3 border-b px-5 py-3"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in srgb, var(--success-bg) 28%, var(--surface))",
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="success">Awarded</Pill>
              <Pill tone={detail.type === "cpa_credential" ? "accent" : "neutral"}>{typeLabel}</Pill>
            </div>
            <span className="shrink-0 text-[12px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
              {awardedLabel}
            </span>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Issued to
              </p>
              <p className="mt-0.5 text-[18px] font-semibold tracking-[-0.25px]" style={{ color: "var(--ink)" }}>
                {detail.learnerName}
              </p>
            </div>

            <div
              className="rounded-[10px] px-4 py-3"
              style={{ background: "var(--surface-soft)", border: "1px solid var(--border)" }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Credential
              </p>
              <p className="mt-1 text-[15px] font-semibold leading-snug tracking-[-0.2px] text-pretty">
                {detail.credentialName}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {typeLabel}
                {expiresLabel ? ` · Expires ${expiresLabel}` : " · Does not expire"}
              </p>
            </div>

            <ul className="grid gap-2 sm:grid-cols-2">
              <MetaTile label="Learner access" value="Certificates & Credentials" />
              <MetaTile label="Public check" value="Verify ownership" />
            </ul>

            {detail.expiresAt ? (
              <div className="pt-1">
                <RenewCredentialButton credentialId={detail.id} expiresAt={detail.expiresAt} />
              </div>
            ) : null}
          </div>
        </article>

        <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
          <Button href="/academy/admin/credentials" variant="secondary">
            Back to Certificates
          </Button>
          {verifyHref ? (
            <Button href={verifyHref} variant="primary">
              Verify certificate
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <li
      className="rounded-[9px] px-3.5 py-2.5"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <p className="text-[11.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p className="mt-0.5 text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
        {value}
      </p>
    </li>
  );
}

export function AdminCredentialAwardedPage({ credentialId }: { credentialId: string }) {
  return (
    <Suspense fallback={<CredentialsSkeleton />}>
      <AwardedBody credentialId={credentialId} />
    </Suspense>
  );
}
