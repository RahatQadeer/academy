import { formatCredentialDate } from "../utils/labels";
import { formatCertificateName } from "../utils/presentation";
import type { VerifyCredentialResult } from "../services/verifyCredential";

export function VerifyCertificateResult({
  code,
  result,
}: {
  code: string;
  result: VerifyCredentialResult;
}) {
  if (!result.ok) {
    return <ErrorResult code={code} reason={result.reason} />;
  }

  const { data } = result;
  const expired = data.expired;

  return (
    <article
      className="overflow-hidden rounded-[12px] border border-line bg-surface"
      style={{
        boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 12px 32px rgba(15,15,15,.05)",
      }}
    >
      <div
        className="relative border-b border-line px-5 py-6"
        style={{
          background: expired
            ? "linear-gradient(165deg, var(--warning-bg) 0%, #fff 72%)"
            : "linear-gradient(165deg, color-mix(in srgb, var(--success-bg) 70%, white) 0%, #fff 72%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill expired={expired} />
              <span className="rounded-[6px] border border-line bg-surface px-2 py-1 font-mono text-[11.5px] font-semibold tracking-[0.05em] text-ink">
                {data.publicId}
              </span>
              {data.displayId !== data.publicId ? (
                <span
                  className="rounded-[6px] border border-line bg-surface px-2 py-1 font-mono text-[11px] tracking-[0.04em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {data.displayId}
                </span>
              ) : null}
            </div>

            <p
              className="mt-5 text-[12px] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Awarded to
            </p>
            <p className="mt-1 text-[24px] font-bold leading-tight tracking-[-0.4px] text-pretty text-ink sm:text-[26px]">
              {formatCertificateName(data.learnerName)}
            </p>
            <p className="mt-1.5 text-[13.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
              {data.typeLabel}
            </p>
          </div>

          <span
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full sm:inline-flex"
            style={{
              background: expired
                ? "color-mix(in srgb, var(--warning-fg) 12%, white)"
                : "var(--success-bg)",
              color: expired ? "var(--warning-fg)" : "var(--success-fg)",
            }}
            aria-hidden
          >
            {expired ? <AlertIcon /> : <CheckIcon />}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] sm:divide-x sm:divide-y-0">
        <ResultField label="Program" value={data.programName} />
        <ResultField label="Issued" value={formatCredentialDate(data.awardedAt)} />
        <ResultField
          label="Validity"
          value={
            data.expiresAt
              ? expired
                ? `Expired ${formatCredentialDate(data.expiresAt)}`
                : `Through ${formatCredentialDate(data.expiresAt)}`
              : "No expiry on record"
          }
        />
      </dl>
    </article>
  );
}

function ErrorResult({
  code,
  reason,
}: {
  code: string;
  reason: "not_found" | "unavailable" | "invalid_id";
}) {
  const tone =
    reason === "not_found"
      ? {
          bg: "var(--danger-bg)",
          fg: "var(--danger-fg)",
          title: "No awarded credential found",
          body: `We could not verify “${code}”. Check the ID on the certificate, or ask the holder to share their link again.`,
        }
      : reason === "unavailable"
        ? {
            bg: "var(--warning-bg)",
            fg: "var(--warning-fg)",
            title: "Verification temporarily unavailable",
            body: "We could not reach the credential registry. Try again in a moment.",
          }
        : {
            bg: "var(--warning-bg)",
            fg: "var(--warning-fg)",
            title: "ID format not recognized",
            body: `Use a 7-digit Certificate ID such as 1234567, or a printed form like PA-SE-1234567. You entered “${code}”.`,
          };

  return (
    <div
      className="flex gap-3 overflow-hidden rounded-[12px] border px-4 py-4 sm:px-5"
      style={{
        background: tone.bg,
        borderColor: "color-mix(in srgb, currentColor 12%, transparent)",
        color: tone.fg,
      }}
      role="status"
    >
      <span
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, currentColor 10%, white)" }}
        aria-hidden
      >
        <AlertIcon />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{tone.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed opacity-90">{tone.body}</p>
      </div>
    </div>
  );
}

function StatusPill({ expired }: { expired: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em]"
      style={{
        background: expired
          ? "color-mix(in srgb, var(--warning-fg) 12%, white)"
          : "var(--success-bg)",
        color: expired ? "var(--warning-fg)" : "var(--success-fg)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor" }}
        aria-hidden
      />
      {expired ? "Expired" : "Verified"}
    </span>
  );
}

function ResultField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <dt
        className="text-[11px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </dt>
      <dd className="mt-1 text-[14px] font-medium leading-snug text-pretty text-ink">{value}</dd>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.5 12.5l4.2 4.2 8.8-9.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.2" r="1" fill="currentColor" />
    </svg>
  );
}
