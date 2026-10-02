import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/base/lib/supabase/server";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { SuperAdminAccessRequired } from "../components/SuperAdminAccessRequired";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, canAccessSuperAdminArea } from "@/academy/lib/authorization";
import { AdminManageView } from "./components/AdminManageView";
import { AdminSkeleton } from "./components/AdminSkeleton";
import { loadAdminDetail } from "./services/loadAdminDetail";

async function AdminDetailBody({ userId }: { userId: string }) {
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

  const [result, { count: activeAdminCount }] = await Promise.all([
    loadAdminDetail(userId),
    (async () => {
      const supabase = await createClient();
      return supabase
        .from("academy_memberships")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("status", "active");
    })(),
  ]);

  if (!result.ok && result.reason === "unauthorized") {
    return (
      <PageShell>
        <SuperAdminAccessRequired />
      </PageShell>
    );
  }

  if (!result.ok && result.reason === "not_admin") {
    return (
      <PageShell>
        <Link
          href="/academy/admin/admins"
          className="mb-6 inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
        >
          ← Admins
        </Link>
        <ErrorState
          title="This user is not an Academy Admin"
          body="Grant Admin from the Admins page first."
        />
      </PageShell>
    );
  }

  if (!result.ok && result.reason === "not_found") {
    return (
      <PageShell>
        <Link
          href="/academy/admin/admins"
          className="mb-6 inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
        >
          ← Admins
        </Link>
        <ErrorState title="Admin not found" body="This Admin profile could not be opened." />
      </PageShell>
    );
  }

  if (!result.ok) {
    return (
      <PageShell>
        <Link
          href="/academy/admin/admins"
          className="mb-6 inline-block text-[13px] font-medium text-accent no-underline hover:text-accent-hover"
        >
          ← Admins
        </Link>
        <ErrorState
          title="Admin unavailable"
          body="Admin activity could not be loaded. Try again in a moment."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminManageView detail={result.data} canRevoke={(activeAdminCount ?? 0) > 1} />
    </PageShell>
  );
}

export function AcademyAdminDetailPage({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminDetailBody userId={userId} />
    </Suspense>
  );
}
