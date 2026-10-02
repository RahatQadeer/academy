import Link from "next/link";
import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { AppliedWorkSubmitForm } from "./components/AppliedWorkSubmitForm";
import { CredentialSkeleton } from "./components/CredentialSkeleton";
import { loadSubmitAppliedWork } from "./services/loadCredentialDetail";

async function SubmitBody({
  userId,
  credentialId,
}: {
  userId: string;
  credentialId: string;
}) {
  const result = await loadSubmitAppliedWork(userId, credentialId);

  if (!result.ok) {
    return (
      <PageShell>
        <ErrorState
          title={
            result.reason === "unavailable"
              ? "Nothing to submit"
              : "Submission unavailable"
          }
          body={
            result.reason === "unavailable"
              ? "All required submissions are in or applied work is not open yet."
              : "This submission form could not be opened."
          }
        />
        <p className="mt-4">
          <Link
            href={`/academy/credentials/${credentialId}`}
            className="text-[13.5px] no-underline"
            style={{ color: "var(--accent)" }}
          >
            Back to credential
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AppliedWorkSubmitForm
        credentialId={result.credentialId}
        programName={result.programName}
        slot={result.slot}
      />
    </PageShell>
  );
}

export function SubmitAppliedWorkPage({
  userId,
  credentialId,
  preview,
}: {
  userId: string;
  credentialId: string;
  preview: boolean;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<CredentialSkeleton />}>
        <SubmitBody userId={userId} credentialId={credentialId} />
      </Suspense>
    </AcademyEntry>
  );
}
