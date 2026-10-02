import Link from "next/link";
import { PageHeader, PageShell } from "@/academy/components/ui";
import { NewProgramForm } from "../components/NewProgramForm";

export function NewProgramPage() {
  return (
    <PageShell>
      <Link
        href="/academy/instructor/programs"
        className="inline-flex text-[13px] font-medium text-accent no-underline transition-colors hover:text-accent-hover"
      >
        ← My Programs
      </Link>
      <PageHeader
        className="mb-6 mt-3"
        eyebrow="Instructor"
        title="New program"
        description="Set the essentials below. Submit for Admin approval when the curriculum is ready."
      />
      <NewProgramForm />
    </PageShell>
  );
}
