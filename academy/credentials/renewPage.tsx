import { Suspense } from "react";
import { Callout } from "@/base/components/Callout";
import { PageHeader, PageShell } from "@/academy/components/ui";
import { loadLearnerRenewal } from "./services/loadLearnerRenewal";
import { LearnerRenewalView } from "./components/LearnerRenewalView";

async function RenewBody({
  credentialId,
  flash,
}: {
  credentialId: string;
  flash?: "paid" | "canceled" | null;
}) {
  const result = await loadLearnerRenewal(credentialId);
  if (!result.ok) {
    const title =
      result.reason === "unauthorized"
        ? "Sign in required"
        : result.reason === "invalid"
          ? "Renewal not available"
          : "Certificate not found";
    const body =
      result.reason === "invalid"
        ? "Only awarded certificates with an expiration date can be renewed."
        : "This renewal page could not be opened.";
    return (
      <PageShell>
        <PageHeader eyebrow="Outcomes" title="Certificate renewal" />
        <Callout tone="warning" title={title}>
          {body}
        </Callout>
      </PageShell>
    );
  }
  return <LearnerRenewalView data={result.data} flash={flash} />;
}

export function CredentialRenewPage({
  credentialId,
  flash,
}: {
  credentialId: string;
  flash?: "paid" | "canceled" | null;
}) {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Loading renewal…
          </p>
        </PageShell>
      }
    >
      <RenewBody credentialId={credentialId} flash={flash} />
    </Suspense>
  );
}
