import { Suspense } from "react";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import {
  ErrorState,
  PageShell,
  SkeletonBlock,
  SkeletonHeader,
  SkeletonPage,
} from "@/academy/components/ui";
import { canCreateCatalogProgram, isAcademySuperAdmin } from "@/academy/lib/authorization";
import { getSessionProfile } from "@/base/identity/session";
import { AdminHeader } from "../components/AdminHeader";
import { CatalogEmptyState } from "../components/CatalogEmptyState";
import { CatalogHeader } from "../components/CatalogHeader";
import { CatalogList } from "../components/CatalogList";
import { CatalogSummary } from "../components/CatalogSummary";
import { WhitbyPromptCard } from "../components/WhitbyPromptCard";
import { loadAcademySettings } from "../settings/services/loadAcademySettings";
import { loadCatalogPrograms } from "../services/loadCatalogPrograms";

function ProgramsSkeleton() {
  return (
    <SkeletonPage label="Loading Academy programs…">
      <SkeletonHeader eyebrow={false} />
      <div
        className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] sm:grid-cols-5"
        style={{ border: "1px solid var(--border)", background: "var(--border)" }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="bg-surface px-5 py-4">
            <SkeletonBlock className="h-3 w-14" />
            <SkeletonBlock className="mt-2.5 h-7 w-10" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="mb-5 h-[180px] rounded-[10px]" />
      <div
        className="overflow-hidden rounded-[10px] bg-surface"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
          <SkeletonBlock className="h-5 w-28" />
          <SkeletonBlock className="mt-2 h-4 w-64 max-w-full" />
        </div>
        <SkeletonBlock className="h-[280px] rounded-none" />
      </div>
    </SkeletonPage>
  );
}

async function ProgramsBody() {
  const profile = await getSessionProfile();
  const actor = profile ? { id: profile.user.id } : null;
  const [catalogResult, settingsResult, canCreate, isSuperAdmin] = await Promise.all([
    loadCatalogPrograms(),
    loadAcademySettings(),
    actor ? canCreateCatalogProgram(actor) : Promise.resolve(false),
    actor ? isAcademySuperAdmin(actor) : Promise.resolve(false),
  ]);

  if (!catalogResult.ok && catalogResult.reason === "unauthorized") {
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

  if (!catalogResult.ok) {
    return (
      <PageShell>
        <AdminHeader
          title="Programs"
          description={
            isSuperAdmin
              ? "Review the catalog, publish approvals, and manage what learners see."
              : "Create programs, generate a draft with Whitby, and manage the live catalog."
          }
        />
        <ErrorState
          title="Programs unavailable"
          body="Programs could not be loaded. Nothing has changed — try again."
        />
      </PageShell>
    );
  }

  const programs = catalogResult.programs;
  const showWhitbyDrafting =
    canCreate && settingsResult.ok && settingsResult.settings.whitbyAssistedDrafting;

  return (
    <PageShell>
      <AdminHeader
        title="Programs"
        description={
          isSuperAdmin
            ? "Review the catalog and what learners see in Explore. Academy Admins and Instructors create programs."
            : "Build the catalog, generate drafts with Whitby, and control what learners see in Explore."
        }
      />

      {isSuperAdmin ? (
        <div className="mb-4">
          <Callout tone="info" title="Management view">
            Super Admin manages people and access. Program creation and Whitby drafting stay with
            Academy Admins and Instructors.
          </Callout>
        </div>
      ) : null}

      {programs.length > 0 ? <CatalogSummary programs={programs} /> : null}

      {showWhitbyDrafting ? (
        <section aria-label="Whitby program builder" className="mb-4">
          <WhitbyPromptCard framed />
        </section>
      ) : null}

      <section aria-label="Academy programs">
        <div
          className="overflow-hidden rounded-[10px] bg-surface"
          style={{ border: "1px solid var(--border)" }}
        >
          {programs.length === 0 ? (
            <>
              <div className="border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border)" }}>
                <CatalogHeader count={0} allowCreate={canCreate} />
              </div>
              <div className="px-5 py-8 sm:px-6">
                <CatalogEmptyState showWhitbyPrompt={showWhitbyDrafting} allowCreate={canCreate} />
              </div>
            </>
          ) : (
            <CatalogList programs={programs} allowCreate={canCreate} />
          )}
        </div>
      </section>
    </PageShell>
  );
}

export function AdminProgramsPage() {
  return (
    <Suspense fallback={<ProgramsSkeleton />}>
      <ProgramsBody />
    </Suspense>
  );
}
