import { Suspense } from "react";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessSuperAdminArea,
} from "@/academy/lib/authorization";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { SuperAdminAccessRequired } from "../components/SuperAdminAccessRequired";
import { AdminsShell } from "./components/AdminsShell";
import { AdminSkeleton } from "./components/AdminSkeleton";
import { loadAdmins } from "./services/loadAdmins";

async function AdminsBody() {
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

  const result = await loadAdmins();

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
          title="Admins unavailable"
          body="Academy Admins could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminsShell data={result.data} />
    </PageShell>
  );
}

export function AcademyAdminsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminsBody />
    </Suspense>
  );
}
