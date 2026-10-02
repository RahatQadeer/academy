import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { AdminHeader } from "../components/AdminHeader";
import { ReviewQueueTable } from "./components/ReviewQueueTable";
import { AwardedTable } from "./components/AwardedTable";
import { CredentialFilters } from "./components/CredentialFilters";
import { CredentialsSkeleton } from "./components/CredentialsSkeleton";
import { loadAdminCredentials } from "./services/loadAdminCredentials";
import { parseCredentialFilters } from "./utils/filters";
import { Suspense } from "react";

async function CredentialsBody({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseCredentialFilters(searchParams);
  const result = await loadAdminCredentials(filters);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <AdminAccessRequired />
      </PageShell>
    );
  }

  if (!result.ok) {
    return (
      <PageShell>
        <AdminHeader
          title="Certificates & Credentials"
          description="Review completed programs before they become official, and see what has already been awarded."
        />
        <ErrorState
          title="Credentials unavailable"
          body="Credentials could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  const showPending = filters.view === "pending";
  const showAwarded = filters.view === "awarded";
  const showExpired = filters.view === "expired";
  const showAll = filters.view === "all";

  return (
    <PageShell>
      <AdminHeader
        title="Certificates & Credentials"
        description="Award the three Academy certificate types: Certified Private Attaché, Certificate of Completion, and Specialty Endorsement. Learner requests appear here — not under Publish Approvals."
        actions={
          <a
            href="/academy/admin/credentials/renewals"
            className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink no-underline hover:bg-surface-soft"
          >
            Renewal requests
          </a>
        }
      />
      <div className="mb-5 rounded-[12px] border bg-surface p-4 sm:p-5" style={{ borderColor: "var(--border)" }}>
        <CredentialFilters filters={filters} />
      </div>
      <div className="space-y-6">
        {showPending ? <ReviewQueueTable items={result.data.visible} /> : null}
        {showAwarded ? <AwardedTable items={result.data.visible} /> : null}
        {showExpired ? (
          <AwardedTable
            items={result.data.visible}
            heading="Expired"
            description="Awarded certificates whose term has already ended. Open a row to verify or renew."
            countLabel="expired"
          />
        ) : null}
        {showAll ? (
          <>
            <ReviewQueueTable items={result.data.visible.filter((item) => item.status !== "awarded")} />
            <AwardedTable items={result.data.visible.filter((item) => item.status === "awarded")} />
          </>
        ) : null}
        {result.data.truncatedPending || result.data.truncatedAwarded ? (
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Showing the first 48 records per source list before filtering.
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}

export function AdminCredentialsPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const filters = parseCredentialFilters(searchParams);
  // Key by view/type/search so Suspense remounts and shows the skeleton on each list switch.
  const suspenseKey = `${filters.view}:${filters.type}:${filters.status}:${filters.search}`;

  return (
    <Suspense key={suspenseKey} fallback={<CredentialsSkeleton />}>
      <CredentialsBody searchParams={searchParams} />
    </Suspense>
  );
}
