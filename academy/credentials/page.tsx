import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { CredentialList } from "./components/CredentialList";
import { CredentialSkeleton } from "./components/CredentialSkeleton";
import { CredentialsHeader } from "./components/CredentialsHeader";
import { loadCredentials } from "./services/loadCredentials";
import { groupCredentials } from "./utils/presentation";

async function CredentialsBody({ userId }: { userId: string }) {
  const result = await loadCredentials(userId);

  if (!result.ok) {
    return (
      <PageShell>
        <CredentialsHeader />
        <ErrorState
          title="Credentials unavailable"
          body="Your credentials could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  const grouped = groupCredentials(result.data.items);

  return (
    <PageShell>
      <CredentialsHeader />
      <CredentialList
        credentials={grouped.credentials}
        endorsements={grouped.endorsements}
        certificates={grouped.certificates}
      />
      {result.data.truncated ? (
        <p className="mt-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Showing the first 48 credentials.
        </p>
      ) : null}
    </PageShell>
  );
}

export function CredentialsPage({
  userId,
  preview,
}: {
  userId: string;
  preview: boolean;
}) {
  return (
    <AcademyEntry userId={userId} preview={preview}>
      <Suspense fallback={<CredentialSkeleton />}>
        <CredentialsBody userId={userId} />
      </Suspense>
    </AcademyEntry>
  );
}
