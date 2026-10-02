import { Suspense } from "react";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessSuperAdminArea,
} from "@/academy/lib/authorization";
import { PageShell } from "@/academy/components/ui";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { SuperAdminAccessRequired } from "../components/SuperAdminAccessRequired";
import { AdminListSkeleton } from "../components/AdminSkeleton";
import { UsersManager } from "./components/UsersManager";

async function UsersBody() {
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

  return (
    <PageShell className="max-w-[920px]">
      <UsersManager />
    </PageShell>
  );
}

export function AcademyUsersPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <UsersBody />
    </Suspense>
  );
}
