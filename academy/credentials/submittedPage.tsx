import Link from "next/link";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { PageShell } from "@/academy/components/ui";

export function SubmittedConfirmationPage({
  userId,
  credentialId,
  programName,
  submissionIndex,
  submissionTotal,
  preview,
}: {
  userId: string;
  credentialId: string;
  programName: string;
  submissionIndex: number;
  submissionTotal: number;
  preview: boolean;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <PageShell>
        <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
          <span
            className="inline-flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "var(--success-bg)", color: "var(--success-fg)" }}
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 8.2 6.6 11.2 12.5 4.8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h1 className="mt-6 text-[28px] font-medium">Submitted</h1>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Submission {submissionIndex} of {submissionTotal} is in for review — you&apos;ll be
            notified within 5 business days.
          </p>
          <Link
            href={`/academy/credentials/${credentialId}`}
            className="mt-8 text-[14px] no-underline hover:text-accent-hover"
            style={{ color: "var(--accent)" }}
          >
            ← Back to {programName}
          </Link>
        </div>
      </PageShell>
    </AcademyEntry>
  );
}
