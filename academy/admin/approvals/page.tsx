import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { AdminHeader } from "../components/AdminHeader";
import { ErrorState, PageShell } from "@/academy/components/ui";
import type { QueueStatusFilter } from "../types";
import { ApprovalQueue } from "./components/ApprovalQueue";
import { ApprovalSkeleton } from "./components/ApprovalSkeleton";
import { loadPublishRequests } from "./services/loadPublishRequests";
import { parseQueueFilter } from "./utils/labels";
import { Suspense } from "react";

function ApprovalsHeader() {
  return (
    <AdminHeader
      title="Publish Approvals"
      description="Review instructor publish requests, return any that need edits, then publish to Explore. Past decisions stay available in each tab."
    />
  );
}

async function ApprovalsBody({ filter }: { filter: QueueStatusFilter }) {
  const result = await loadPublishRequests(filter);

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
        <ApprovalsHeader />
        <ErrorState
          title="Approval queue unavailable"
          body="Publish requests could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ApprovalsHeader />
      <ApprovalQueue data={result.data} />
    </PageShell>
  );
}

export function AdminApprovalsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filter = parseQueueFilter(searchParams.status);
  return (
    <Suspense fallback={<ApprovalSkeleton />}>
      <ApprovalsBody filter={filter} />
    </Suspense>
  );
}
