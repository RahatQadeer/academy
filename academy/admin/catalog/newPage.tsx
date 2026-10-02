import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { PageHeader, PageShell } from "@/academy/components/ui";
import { canCreateCatalogProgram } from "@/academy/lib/authorization";
import { getSessionProfile } from "@/base/identity/session";
import { AdminNewProgramForm } from "./components/AdminNewProgramForm";

export async function AdminNewProgramPage() {
  const profile = await getSessionProfile();
  const canCreate = profile
    ? await canCreateCatalogProgram({ id: profile.user.id })
    : false;

  return (
    <PageShell>
      <Link
        href="/academy/admin/programs"
        className="inline-flex text-[13px] font-medium text-accent no-underline transition-colors hover:text-accent-hover"
      >
        ← Programs
      </Link>
      <PageHeader
        className="mb-6 mt-3"
        eyebrow="Course Builder"
        title="New program"
        description="Set the essentials below. Curriculum and publishing come next in the builder."
      />
      {canCreate ? (
        <AdminNewProgramForm />
      ) : (
        <Callout tone="warning" title="Academy Admins create programs">
          Super Admin manages people and access. Ask an Academy Admin to create a new program.
        </Callout>
      )}
    </PageShell>
  );
}
