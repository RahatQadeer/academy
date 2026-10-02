import { Suspense } from "react";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessSuperAdminArea,
} from "@/academy/lib/authorization";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { SuperAdminAccessRequired } from "../components/SuperAdminAccessRequired";
import { AdminListSkeleton } from "../components/AdminSkeleton";
import { AuditLogList } from "./components/AuditLogList";
import { loadAuditLogs } from "./services/loadAuditLogs";

async function AuditBody() {
  const profile = await getSessionProfile();
  if (!profile) {
    return (
      <PageShell>
        <AdminAccessRequired />
      </PageShell>
    );
  }

  const actor = { id: profile.user.id };
  const [superArea, adminArea] = await Promise.all([
    canAccessSuperAdminArea(actor),
    canAccessAdminArea(actor),
  ]);

  if (!superArea) {
    return (
      <PageShell>
        {adminArea ? <SuperAdminAccessRequired /> : <AdminAccessRequired />}
      </PageShell>
    );
  }

  const result = await loadAuditLogs();
  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <SuperAdminAccessRequired />
      </PageShell>
    );
  }
  if (!result.ok) {
    return (
      <PageShell>
        <ErrorState
          title="Activity unavailable"
          body={result.message || "Sensitive activity could not be loaded. Try again."}
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-[920px] space-y-6">
      <header className="flex items-end justify-between gap-4">
        <h1
          className="text-[28px] font-semibold tracking-[-0.5px]"
          style={{ color: "var(--ink)" }}
        >
          Activity log
        </h1>
        <p
          className="pb-1 text-[13px] font-medium tabular-nums"
          style={{ color: "var(--text-tertiary)" }}
        >
          {result.data.items.length.toLocaleString()}
        </p>
      </header>
      <AuditLogList items={result.data.items} truncated={result.data.truncated} />
    </PageShell>
  );
}

export function AcademyAuditLogsPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <AuditBody />
    </Suspense>
  );
}
