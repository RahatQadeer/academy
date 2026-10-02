import Link from "next/link";
import { Suspense } from "react";
import { getSessionProfile } from "@/base/identity/session";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AcademyEntry } from "@/academy/AcademyEntry";
import { CredentialAwardedView } from "./components/CredentialAwardedView";
import { CredentialProgressView } from "./components/CredentialProgressView";
import { CredentialSkeleton } from "./components/CredentialSkeleton";
import { loadCredentialDetail } from "./services/loadCredentialDetail";

function displayName(profile: Awaited<ReturnType<typeof getSessionProfile>>) {
  if (!profile) return "Learner";
  const user = profile.user;
  return (user.full_name || user.preferred_name || user.email || "Learner").trim();
}

async function CredentialDetailBody({
  userId,
  credentialId,
}: {
  userId: string;
  credentialId: string;
}) {
  const profile = await getSessionProfile();
  const result = await loadCredentialDetail(userId, credentialId, displayName(profile));

  if (!result.ok) {
    return (
      <PageShell>
        <ErrorState
          title="Credential unavailable"
          body={
            result.reason === "unauthorized"
              ? "You can only view credentials issued to your account."
              : "This credential could not be loaded."
          }
        />
        <p className="mt-4">
          <Link
            href="/academy/credentials"
            className="text-[13.5px] no-underline"
            style={{ color: "var(--accent)" }}
          >
            Back to credentials
          </Link>
        </p>
      </PageShell>
    );
  }

  const { data } = result;

  if (data.status === "awarded") {
    return <CredentialAwardedView data={data} />;
  }

  return (
    <PageShell>
      <CredentialProgressView data={data} />
    </PageShell>
  );
}

export function CredentialDetailPage({
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
        <CredentialDetailBody userId={userId} credentialId={credentialId} />
      </Suspense>
    </AcademyEntry>
  );
}

/** @deprecated Use CredentialDetailPage */
export const CertificatePage = CredentialDetailPage;
