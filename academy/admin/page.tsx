import { Suspense } from "react";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { getSessionProfile } from "@/base/identity/session";
import { isAcademySuperAdmin } from "@/academy/lib/authorization";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminDashboardActivity } from "./components/AdminDashboardActivity";
import { AdminDashboardAttention } from "./components/AdminDashboardAttention";
import { AdminDashboardOps } from "./components/AdminDashboardOps";
import { AdminDashboardStats } from "./components/AdminDashboardStats";
import { SuperAdminDashboard } from "./components/SuperAdminDashboard";
import { AdminHeader } from "./components/AdminHeader";
import { AdminSkeleton } from "./components/AdminSkeleton";
import { loadAdminDashboard } from "./services/loadAdminDashboard";

function greetingFor(timezone: string | null) {
  const zone = timezone || "UTC";
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: zone,
      }).format(new Date()),
    );
  } catch {
    hour = new Date().getUTCHours();
  }
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function dashboardTitle(displayName: string, timezone: string | null) {
  const firstName = displayName.trim().split(/\s+/)[0] ?? "";
  const greeting = greetingFor(timezone);
  return firstName ? `${greeting}, ${firstName}` : greeting;
}

async function DashboardBody() {
  const profile = await getSessionProfile();
  const displayName = profile?.user.preferred_name || profile?.user.full_name || "";
  const timezone = profile?.user.timezone ?? null;
  const superAdmin = profile ? await isAcademySuperAdmin({ id: profile.user.id }) : false;
  const title = dashboardTitle(displayName, timezone);

  const dashboardResult = await loadAdminDashboard();

  if (!dashboardResult.ok && dashboardResult.reason === "unauthorized") {
    return (
      <PageShell>
        <Callout tone="warning" title="Admin access required">
          <p>
            This area is limited to Academy Admins. Ask a Private Attaché administrator if you
            need access.
          </p>
          <div className="mt-3">
            <Button href="/academy" variant="secondary">
              Back to Academy
            </Button>
          </div>
        </Callout>
      </PageShell>
    );
  }

  if (!dashboardResult.ok) {
    return (
      <PageShell>
        <AdminHeader
          title={title}
          description="Academy operations could not be loaded. Nothing has changed — try again."
        />
        <ErrorState
          title="Dashboard unavailable"
          body="Enrollment, catalog, and review totals could not be loaded."
        />
      </PageShell>
    );
  }

  const data = dashboardResult.data;

  if (superAdmin) {
    return (
      <PageShell>
        <SuperAdminDashboard data={data} greeting={title} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminHeader
        title={title}
        description="Academy operations — enrollments, catalog health, and work waiting on you."
      />

      <div className="space-y-6">
        <AdminDashboardStats data={data} />
        <AdminDashboardAttention
          pendingCount={data.pendingCount}
          credentialReviewCount={data.credentialReviewCount}
        />
        <AdminDashboardActivity data={data} />
        <AdminDashboardOps data={data} />
      </div>
    </PageShell>
  );
}

export function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <DashboardBody />
    </Suspense>
  );
}
