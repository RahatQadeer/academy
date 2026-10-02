import { Suspense } from "react";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import { loadCourseTags } from "@/academy/lib/courseTags/services";
import { getSessionProfile } from "@/base/identity/session";
import { AdminAccessRequired } from "../components/AdminAccessRequired";
import { AdminHeader } from "../components/AdminHeader";
import { TagsPageClient } from "./components/TagsPageClient";

function TagsSkeleton() {
  return (
    <PageShell>
      <AdminHeader
        title="Tags"
        description="Course topic tags for catalog programs. Built-in and custom tags share one bank."
      />
      <div className="h-40 animate-pulse rounded-[12px]" style={{ background: "var(--surface-soft)" }} />
    </PageShell>
  );
}

async function TagsBody() {
  const profile = await getSessionProfile();
  if (!profile) {
    return (
      <PageShell>
        <AdminAccessRequired />
      </PageShell>
    );
  }

  const actor = { id: profile.user.id };
  const [area, admin, result] = await Promise.all([
    canAccessAdminArea(actor),
    isAcademyAdmin(actor),
    loadCourseTags({ includeArchived: true, withCounts: true }),
  ]);

  if (!area || !admin) {
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
          title="Tags"
          description="Course topic tags for catalog programs. Built-in and custom tags share one bank."
        />
        <ErrorState title="Tags unavailable" body="The tag bank could not be loaded. Try again." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AdminHeader
        title="Tags"
        description="Manage the course tag bank. Programs must pick exactly 3 tags from this list. Built-in vs custom only shows here."
      />
      <TagsPageClient initialTags={result.tags} />
    </PageShell>
  );
}

export function AdminTagsPage() {
  return (
    <Suspense fallback={<TagsSkeleton />}>
      <TagsBody />
    </Suspense>
  );
}
