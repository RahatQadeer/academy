import Link from "next/link";
import { PageHeader, PageShell } from "@/academy/components/ui";
import { VerifyCertificateForm } from "./components/VerifyCertificateForm";
import { VerifyCertificateResult } from "./components/VerifyCertificateResult";
import { verifyCredentialByPublicId } from "./services/verifyCredential";
import { normalizeCredentialPublicId } from "./utils/publicId";

export async function VerifyCertificatePage({
  code,
}: {
  code?: string;
}) {
  const normalized = code ? normalizeCredentialPublicId(code) : "";
  const result = normalized
    ? await verifyCredentialByPublicId(normalized)
    : null;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Outcomes"
        title="Verify"
        description="Confirm a Private Attaché Academy certificate by its ID. A match shows the holder, program, and issue date."
        actions={
          <Link
            href="/academy/credentials"
            className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink no-underline transition-colors hover:bg-surface-soft"
          >
            Your certificates
          </Link>
        }
      />

      <div className="flex w-full max-w-[960px] flex-col gap-4">
        <VerifyCertificateForm initialCode={normalized} />

        {result ? (
          <VerifyCertificateResult code={normalized} result={result} />
        ) : (
          <HowItWorks />
        )}

        <p
          className="px-0.5 text-[12px] leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          Awarded credentials only. If the holder name does not match the person
          presenting the certificate, treat it as unverified.
        </p>
      </div>
    </PageShell>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Find the ID",
      body: "On the PDF or share link — the 7-digit ID, or the printed form (PA-CC / PA-CPA / PA-SE).",
    },
    {
      n: "2",
      title: "Check the registry",
      body: "Only awarded credentials appear. Drafts never do.",
    },
    {
      n: "3",
      title: "Confirm the holder",
      body: "Match the name, program, type, and issue date.",
    },
  ] as const;

  return (
    <div className="rounded-[12px] border border-line bg-surface px-5 py-5">
      <p
        className="mb-4 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        How it works
      </p>
      <ol className="grid gap-4 sm:grid-cols-3 sm:gap-3">
        {steps.map((step) => (
          <li key={step.n} className="min-w-0">
            <span
              className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
              style={{
                background: "color-mix(in srgb, var(--module-academy-fg) 10%, white)",
                color: "var(--module-academy-fg)",
              }}
            >
              {step.n}
            </span>
            <p className="text-[13px] font-semibold text-ink">{step.title}</p>
            <p
              className="mt-0.5 text-[12.5px] leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
